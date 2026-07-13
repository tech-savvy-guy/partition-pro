from datetime import datetime, timezone as dt_timezone
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from core.models import (
    Case,
    CaseUserAssignment,
    Dataset,
    Metadata,
    Partition,
    RawAttributesData,
    RawCrossPurchaseData,
    RawPosData,
    User,
    WorkflowRun,
)
from core.services import workflow_store
from core.services.ingestion import DatasetIngestionError, ingest_dataset
from core.services.preprocessing.build import preprocessing_signature
from core.services.roi.coverage import compute_coverage
from core.services.sku_selection import get_sku_selection_payload
from core.views import (
    CaseDatasetDetailView,
    CaseDatasetPreviewView,
    CasePartitionLocksReleaseView,
    CasePartitionsView,
    CasePreprocessingRunView,
    PartitionLockView,
    PartitionSkuSelectionView,
    PartitionTreeAttributeSelectionView,
    PartitionTreeNodeColorsView,
    PartitionTreeNodeView,
    PartitionWorkflowProcessRunView,
    PartitionWorkflowStatusView,
    PreprocessingStatusView,
    RoiLatestView,
)


def create_ready_metadata(case, **overrides):
    """A READY ``Metadata`` row matching the case's currently selected
    datasets — what ``require_case_ready`` checks before allowing any
    partition compute/mutation."""
    from core.services.sku_selection import _get_selected_raw_datasets

    selected = _get_selected_raw_datasets(str(case.id))
    fields = {
        "case_id": case.id,
        "signature": preprocessing_signature(
            selected.pos, selected.attributes, selected.cross_purchase
        ),
        "status": Metadata.Status.READY,
        "pos_dataset_id": selected.pos.id if selected.pos else None,
        "att_dataset_id": selected.attributes.id if selected.attributes else None,
        "cp_dataset_id": selected.cross_purchase.id if selected.cross_purchase else None,
    }
    fields.update(overrides)
    return Metadata.objects.create(**fields)


class CaseDatasetPreviewTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(
            entra_oid="oid-3",
            tenant_id="tenant-1",
            email="preview-user@example.com",
        )
        self.case = Case.objects.create(
            name="Case",
            code="PREVCASE",
            created_by=self.user,
            updated_by=self.user,
        )

    @patch("core.views.generate_blob_sas_url")
    @patch("core.views.ensure_azure_storage_configured")
    def test_dataset_preview_returns_sas_url(self, _ensure, generate_sas):
        dataset = Dataset.objects.create(
            case=self.case,
            type=Dataset.Type.POS,
            version=1,
            file_name="pos.csv",
            blob_name="pos.csv",
            status=Dataset.Status.READY,
            tags={"columns_order": ["SKU", "Sales"]},
            created_by=self.user,
        )
        expires_at = datetime(2026, 1, 1, tzinfo=dt_timezone.utc)
        generate_sas.return_value = ("https://blob.example/pos.csv?sas", expires_at)

        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)

        response = CaseDatasetPreviewView.as_view()(
            request,
            case_id=self.case.id,
            dataset_id=dataset.id,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["preview_url"], "https://blob.example/pos.csv?sas")
        self.assertEqual(response.data["expires_at"], expires_at.isoformat())
        self.assertEqual(response.data["dataset"]["id"], str(dataset.id))

    def test_dataset_preview_returns_404_for_missing_dataset(self):
        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)

        import uuid
        response = CaseDatasetPreviewView.as_view()(
            request,
            case_id=self.case.id,
            dataset_id=uuid.uuid4(),
        )

        self.assertEqual(response.status_code, 404)



class _Blob:
    def __init__(self, text):
        self.text = text

    def download_blob(self):
        return self

    def readall(self):
        return self.text.encode("utf-8")


class DatasetIngestionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(
            entra_oid="oid-1",
            tenant_id="tenant-1",
            email="user@example.com",
        )
        self.case = Case.objects.create(
            name="Case",
            code="CASE",
            created_by=self.user,
            updated_by=self.user,
        )

    def _dataset(self, version, *, selected=False, status=Dataset.Status.PROCESSING):
        return Dataset.objects.create(
            case=self.case,
            type=Dataset.Type.POS,
            version=version,
            file_name=f"pos-v{version}.csv",
            blob_name=f"cases/{self.case.id}/datasets/pos-v{version}.csv",
            status=status,
            is_selected=selected,
            created_by=self.user,
        )

    @patch("core.services.ingestion.get_blob_client")
    def test_ingest_replaces_current_rows_and_selects_dataset(self, get_blob_client):
        old_dataset = self._dataset(1, selected=True, status=Dataset.Status.READY)
        new_dataset = self._dataset(2)
        RawPosData.objects.create(
            metadata_id=old_dataset.id,
            case_id=self.case.id,
            version=old_dataset.version,
            row_num=1,
            data={"sku": "old"},
        )
        get_blob_client.return_value = _Blob("sku,value\nnew-1,10\nnew-2,20\n")

        result = ingest_dataset(new_dataset)

        self.assertEqual(result.row_count, 2)
        self.assertEqual(result.columns, ["sku", "value"])
        old_dataset.refresh_from_db()
        new_dataset.refresh_from_db()
        self.assertFalse(old_dataset.is_selected)
        self.assertTrue(new_dataset.is_selected)
        self.assertEqual(new_dataset.status, Dataset.Status.READY)
        self.assertEqual(new_dataset.tags["columns_order"], ["sku", "value"])
        self.assertEqual(new_dataset.tags["ingested_rows"], 2)
        self.assertEqual(RawPosData.objects.count(), 2)
        self.assertEqual(
            list(RawPosData.objects.order_by("row_num").values_list("data", flat=True)),
            [{"sku": "new-1", "value": "10"}, {"sku": "new-2", "value": "20"}],
        )

    @patch("core.services.ingestion.get_blob_client")
    def test_ingest_failure_keeps_existing_raw_rows(self, get_blob_client):
        old_dataset = self._dataset(1, selected=True, status=Dataset.Status.READY)
        new_dataset = self._dataset(2)
        RawPosData.objects.create(
            metadata_id=old_dataset.id,
            case_id=self.case.id,
            version=old_dataset.version,
            row_num=1,
            data={"sku": "old"},
        )
        get_blob_client.return_value = _Blob("sku,sku\nbad,header\n")

        with self.assertRaises(DatasetIngestionError):
            ingest_dataset(new_dataset)

        old_dataset.refresh_from_db()
        new_dataset.refresh_from_db()
        self.assertFalse(old_dataset.is_selected)
        self.assertTrue(new_dataset.is_selected)
        self.assertEqual(new_dataset.status, Dataset.Status.FAILED)
        self.assertIn("error_message", new_dataset.tags)
        self.assertEqual(RawPosData.objects.count(), 1)
        self.assertEqual(RawPosData.objects.get().data, {"sku": "old"})


class SkuSelectionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(
            entra_oid="oid-2",
            tenant_id="tenant-1",
            email="viewer@example.com",
        )
        self.case = Case.objects.create(
            name="Case",
            code="SKUCASE",
            created_by=self.user,
            updated_by=self.user,
        )
        self.partition = Partition.objects.create(
            case=self.case,
            name="Partition",
            created_by=self.user,
            updated_by=self.user,
        )
        self.pos_dataset = self._dataset(Dataset.Type.POS, 1, ["skuname_ean", "Brand", "dollar_sales"])
        self.attr_dataset = self._dataset(
            Dataset.Type.ATTRIBUTES,
            1,
            ["skuname_ean", "Brand", "BFY Rolled up"],
        )
        self.cp_dataset = self._dataset(
            Dataset.Type.CROSS_PURCHASE,
            1,
            [
                "category",
                "skuname_ean",
                "total_base_buyers",
                "raw_buyers",
                "is_branded",
                "is_client",
            ],
        )

    def _dataset(self, dataset_type, version, columns):
        return Dataset.objects.create(
            case=self.case,
            type=dataset_type,
            version=version,
            file_name=f"{dataset_type}.csv",
            blob_name=f"cases/{self.case.id}/datasets/{dataset_type}.csv",
            status=Dataset.Status.READY,
            is_selected=True,
            tags={"columns_order": columns},
            created_by=self.user,
        )

    def test_sku_selection_joins_current_raw_rows_by_skuname(self):
        RawCrossPurchaseData.objects.create(
            metadata_id=self.cp_dataset.id,
            case_id=self.case.id,
            version=1,
            row_num=1,
            data={
                "category": "Pizza",
                "skuname_ean": "sku-1",
                "total_base_buyers": "100",
                "raw_buyers": "20",
                "is_branded": "1",
                "is_client": "0",
            },
        )
        RawAttributesData.objects.create(
            metadata_id=self.attr_dataset.id,
            case_id=self.case.id,
            version=1,
            row_num=1,
            data={
                "skuname_ean": "sku-1",
                "Brand": "Attribute Brand",
                "BFY Rolled up": "BFY",
            },
        )
        RawPosData.objects.create(
            metadata_id=self.pos_dataset.id,
            case_id=self.case.id,
            version=1,
            row_num=1,
            data={
                "skuname_ean": "sku-1",
                "Brand": "POS Brand",
                "dollar_sales": "42",
            },
        )

        payload = get_sku_selection_payload(self.case.id, self.partition.id)

        self.assertEqual(payload["pagination"]["total_rows"], 1)
        row = payload["rows"][0]
        self.assertEqual(row["skuname_ean"], "sku-1")
        self.assertEqual(row["Brand"], "Attribute Brand")
        self.assertEqual(row["BFY Rolled up"], "BFY")
        self.assertEqual(row["dollar_sales"], "42")
        self.assertIn("Brand", payload["columns"])
        self.assertIn("dollar_sales", payload["columns"])

    def test_sku_selection_endpoint_returns_empty_when_raw_rows_missing(self):
        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)

        response = PartitionSkuSelectionView.as_view()(
            request,
            case_id=self.case.id,
            partition_id=self.partition.id,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["rows"], [])
        self.assertEqual(response.data["pagination"]["total_rows"], 0)
        self.assertEqual(
            response.data["meta"]["dataset_ids"]["cross_purchase"],
            str(self.cp_dataset.id),
        )

    def test_sku_selection_endpoint_returns_404_for_missing_partition(self):
        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)

        response = PartitionSkuSelectionView.as_view()(
            request,
            case_id=self.case.id,
            partition_id=self.case.id,
        )

        self.assertEqual(response.status_code, 404)


class PartitionTreeWorkflowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(
            entra_oid="oid-pt",
            tenant_id="tenant-1",
            email="pt-user@example.com",
        )
        self.case = Case.objects.create(
            name="Case",
            code="PTCASE",
            created_by=self.user,
            updated_by=self.user,
        )
        self.partition = Partition.objects.create(
            case=self.case,
            name="Partition",
            created_by=self.user,
            updated_by=self.user,
        )
        self.attr_dataset = self._dataset(
            Dataset.Type.ATTRIBUTES, ["skuname_ean", "Brand", "Size"]
        )
        self.cp_dataset = self._dataset(
            Dataset.Type.CROSS_PURCHASE,
            ["category", "skuname_ean", "total_base_buyers", "is_client"],
        )
        # 5 SKUs across Brand A/B and Size L/S; s1 and s3 are client SKUs.
        attrs = {
            "s1": {"Brand": "A", "Size": "L"},
            "s2": {"Brand": "A", "Size": "S"},
            "s3": {"Brand": "B", "Size": "L"},
            "s4": {"Brand": "B", "Size": "L"},
            "s5": {"Brand": "B", "Size": "S"},
        }
        client = {"s1", "s3"}
        for i, (sku, av) in enumerate(attrs.items(), start=1):
            RawAttributesData.objects.create(
                metadata_id=self.attr_dataset.id,
                case_id=self.case.id,
                version=1,
                row_num=i,
                data={"skuname_ean": sku, **av},
            )
            RawCrossPurchaseData.objects.create(
                metadata_id=self.cp_dataset.id,
                case_id=self.case.id,
                version=1,
                row_num=i,
                data={
                    "category": "Pizza",
                    "skuname_ean": sku,
                    "total_base_buyers": "100",
                    "is_client": "1" if sku in client else "0",
                },
            )
        self.skus = list(attrs.keys())
        # The single unified workflow row carrying the saved SKU selection.
        WorkflowRun.objects.create(
            partition=self.partition,
            status=WorkflowRun.Status.COMPLETED,
            triggered_by=self.user,
            parameters={"selected_skus": self.skus},
        )
        # Partition mutations are gated on the case being preprocessed.
        create_ready_metadata(self.case)

    def _dataset(self, dataset_type, columns):
        return Dataset.objects.create(
            case=self.case,
            type=dataset_type,
            version=1,
            file_name=f"{dataset_type}.csv",
            blob_name=f"cases/{self.case.id}/datasets/{dataset_type}.csv",
            status=Dataset.Status.READY,
            is_selected=True,
            tags={"columns_order": columns},
            created_by=self.user,
        )

    def _get(self, view):
        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)
        return view(request, case_id=self.case.id, partition_id=self.partition.id)

    def _post(self, view, body, **extra):
        request = APIRequestFactory().post("/", body, format="json")
        force_authenticate(request, user=self.user)
        return view(
            request, case_id=self.case.id, partition_id=self.partition.id, **extra
        )

    def _patch(self, view, body):
        request = APIRequestFactory().patch("/", body, format="json")
        force_authenticate(request, user=self.user)
        return view(request, case_id=self.case.id, partition_id=self.partition.id)

    def _put(self, view, body, **extra):
        request = APIRequestFactory().put("/", body, format="json")
        force_authenticate(request, user=self.user)
        return view(
            request, case_id=self.case.id, partition_id=self.partition.id, **extra
        )

    def _graph(self):
        data = self._get(PartitionWorkflowStatusView.as_view()).data["data"]
        return data["partition_tree"]

    def _root(self):
        graph = self._graph()
        return next(n for n in graph["nodes"] if n["parent_id"] is None)

    def test_status_seeds_and_returns_root_node(self):
        response = self._get(PartitionWorkflowStatusView.as_view())
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        # The unified result keys plus the derived partition_obm status block;
        # only the tree is seeded.
        self.assertEqual(
            set(data),
            {
                "visualization",
                "partition_tree",
                "sku_math",
                "obm",
                "level_testing",
                "coverage",
                "partition_obm",
            },
        )
        self.assertIsNone(data["visualization"])
        graph = data["partition_tree"]
        self.assertNotIn("edges", graph)
        self.assertEqual(len(graph["nodes"]), 1)
        root = graph["nodes"][0]
        self.assertEqual(root["node_name"], "Shopper's Partition")
        self.assertEqual(root["type"], "root")
        self.assertIsNone(root["parent_id"])
        self.assertEqual(root["level"], 0)
        self.assertEqual(root["sku_count"], 5)
        self.assertEqual(root["client_sku_count"], 2)
        # Root is a leaf until expanded: empty children list, no parent.
        self.assertEqual(root["children"], [])
        # Idempotent: a second call returns the same persisted root, one row.
        again = self._root()
        self.assertEqual(again["id"], root["id"])
        self.assertEqual(
            WorkflowRun.objects.filter(partition=self.partition).count(), 1
        )

    def test_attribute_selection_lists_attributes_with_client_counts(self):
        response = self._post(
            PartitionTreeAttributeSelectionView.as_view(), {"node_obj": self._root()}
        )
        self.assertEqual(response.status_code, 200)
        payload = response.data
        attribute_names = {row[1] for row in payload["attributes_for_test"]["rows"]}
        self.assertEqual(attribute_names, {"Brand", "Size"})
        self.assertEqual(payload["attribute_values"]["Brand"], {"A": 1, "B": 1})
        # The richer per-value counts feed the visualization modal's right sidebar.
        self.assertEqual(
            payload["attribute_value_counts"]["Brand"],
            {
                "A": {"sku_count": 2, "client_count": 1},
                "B": {"sku_count": 3, "client_count": 1},
            },
        )

    def test_save_colors_persists_and_applies_to_value_nodes_on_break(self):
        root = self._root()

        # Saving an invalid hex is rejected.
        bad = self._put(
            PartitionTreeNodeColorsView.as_view(),
            {"attribute_name": "Brand", "colors": {"A": "red"}},
            node_id=root["id"],
        )
        self.assertEqual(bad.status_code, 400)

        # Saving valid colours persists them under the node + attribute.
        ok = self._put(
            PartitionTreeNodeColorsView.as_view(),
            {"attribute_name": "Brand", "colors": {"A": "#112233", "B": "#445566"}},
            node_id=root["id"],
        )
        self.assertEqual(ok.status_code, 200)
        saved = ok.data["data"]["partition_tree"]["attribute_colors"]
        self.assertEqual(
            saved[root["id"]]["Brand"], {"A": "#112233", "B": "#445566"}
        )

        # Attribute selection echoes the saved colours back for this node.
        selection = self._post(
            PartitionTreeAttributeSelectionView.as_view(), {"node_obj": self._root()}
        )
        self.assertEqual(
            selection.data["attribute_colors"]["Brand"],
            {"A": "#112233", "B": "#445566"},
        )

        # Breaking the tree applies the saved colour onto each value node.
        broken = self._post(
            PartitionTreeNodeView.as_view(),
            {"attribute_name": "Brand"},
            node_id=root["id"],
        )
        values = {
            n["node_name"]: n
            for n in broken.data["data"]["partition_tree"]["nodes"]
            if n["type"] == "value"
        }
        self.assertEqual(values["A"]["color"], "#112233")
        self.assertEqual(values["B"]["color"], "#445566")

    def test_node_expansion_creates_attribute_and_value_nodes_and_children(self):
        root = self._root()
        response = self._post(
            PartitionTreeNodeView.as_view(),
            {"attribute_name": "Brand"},
            node_id=root["id"],
        )
        self.assertEqual(response.status_code, 200)
        graph = response.data["data"]["partition_tree"]
        self.assertNotIn("edges", graph)
        nodes = {n["id"]: n for n in graph["nodes"]}

        attr_nodes = [n for n in graph["nodes"] if n["type"] == "attribute"]
        self.assertEqual(len(attr_nodes), 1)
        attr = attr_nodes[0]
        self.assertEqual(attr["attribute"], "Brand")
        self.assertEqual(attr["level"], 1)

        # root links to the attribute node via children / parent_id.
        self.assertEqual(nodes[root["id"]]["children"], [attr["id"]])
        self.assertEqual(attr["parent_id"], root["id"])

        values = {
            n["node_name"]: n for n in graph["nodes"] if n["type"] == "value"
        }
        self.assertEqual(set(values), {"A", "B"})
        self.assertEqual(values["A"]["sku_count"], 2)
        self.assertEqual(values["A"]["client_sku_count"], 1)
        self.assertEqual(values["B"]["sku_count"], 3)
        self.assertEqual(values["A"]["path"], [{"attribute": "Brand", "value": "A"}])
        # The attribute node lists every value node as a child, and each value
        # node points back at the attribute node as its parent and is a leaf.
        self.assertEqual(
            set(attr["children"]), {values["A"]["id"], values["B"]["id"]}
        )
        for value in values.values():
            self.assertEqual(value["parent_id"], attr["id"])
            self.assertEqual(value["children"], [])
        # Every non-root node has a parent in `nodes`.
        for node in graph["nodes"]:
            if node["parent_id"] is not None:
                self.assertIn(node["parent_id"], nodes)

    def test_node_expansion_rejects_duplicate_attribute(self):
        root = self._root()
        self._post(
            PartitionTreeNodeView.as_view(),
            {"attribute_name": "Brand"},
            node_id=root["id"],
        )
        dup = self._post(
            PartitionTreeNodeView.as_view(),
            {"attribute_name": "Brand"},
            node_id=root["id"],
        )
        self.assertEqual(dup.status_code, 403)

    def test_sku_selection_change_clears_both_result_keys_and_keeps_one_row(self):
        from core.services import workflow_store

        # Seed the tree and a fake visualization result on the unified row.
        root = self._root()
        self._post(
            PartitionTreeNodeView.as_view(),
            {"attribute_name": "Brand"},
            node_id=root["id"],
        )
        workflow = workflow_store.get_partition_workflow(self.partition)
        workflow_store.set_visualization(workflow, {"mds_2d": {"rows": []}})
        workflow.save(update_fields=["result"])

        # Change the SKU selection (subset of the 5 available SKUs).
        response = self._patch(
            PartitionSkuSelectionView.as_view(), {"selected_skus": self.skus[:3]}
        )
        self.assertEqual(response.status_code, 200)

        workflow = workflow_store.get_partition_workflow(self.partition)
        self.assertIsNone(workflow_store.get_visualization(workflow))
        self.assertIsNone(workflow_store.get_partition_tree(workflow))
        self.assertEqual(
            WorkflowRun.objects.filter(partition=self.partition).count(), 1
        )


class CoverageComputationTests(TestCase):
    """Hand-computed fixtures for the pandas port of roi-backend's
    core.get_overall_coverage / core.get_attribute_coverage SQL functions."""

    def setUp(self):
        self.user = User.objects.create(
            entra_oid="oid-cov",
            tenant_id="tenant-1",
            email="coverage-user@example.com",
        )
        self.case = Case.objects.create(
            name="Case",
            code="COVCASE",
            created_by=self.user,
            updated_by=self.user,
        )

    def _dataset(self, dataset_type, columns):
        return Dataset.objects.create(
            case=self.case,
            type=dataset_type,
            version=1,
            file_name=f"{dataset_type}.csv",
            blob_name=f"cases/{self.case.id}/datasets/{dataset_type}.csv",
            status=Dataset.Status.READY,
            is_selected=True,
            tags={"columns_order": columns},
            created_by=self.user,
        )

    def _seed_full_fixture(self):
        """5 panel SKUs (s1..s5), one POS-only SKU (p6), Brand attribute.

        POS: s1 A(client, 100/10), s2 A(200/20), s3 B(client, 300/30),
             s4 B(400/40), p6 C(500/50); s5 has no POS row.
        CP:  s1..s5 with raw_buyers 20/10/30/40/50, a 5x5 buyer matrix with a
             zero diagonal and one non-numeric cell ("x" at s4/s5).
        ATT: Brand A/A/B/B for s1..s4; s5 has no Brand key (NULL group).
        """
        self.pos_dataset = self._dataset(
            Dataset.Type.POS,
            ["skuname_ean", "is_client", "dollar_sales", "volume_sales"],
        )
        self.att_dataset = self._dataset(Dataset.Type.ATTRIBUTES, ["skuname_ean", "Brand"])
        self.cp_dataset = self._dataset(
            Dataset.Type.CROSS_PURCHASE,
            [
                "category",
                "total_base_buyers",
                "raw_buyers",
                "is_branded",
                "is_client",
                "skuname_ean",
                "s1",
                "s2",
                "s3",
                "s4",
                "s5",
            ],
        )

        pos_rows = [
            ("s1", "1", "100", "10"),
            ("s2", "0", "200", "20"),
            ("s3", "1", "300", "30"),
            ("s4", "0", "400", "40"),
            ("p6", "0", "500", "50"),
        ]
        for i, (sku, is_client, dollar, volume) in enumerate(pos_rows, start=1):
            RawPosData.objects.create(
                metadata_id=self.pos_dataset.id,
                case_id=self.case.id,
                version=1,
                row_num=i,
                data={
                    "skuname_ean": sku,
                    "is_client": is_client,
                    "dollar_sales": dollar,
                    "volume_sales": volume,
                },
            )

        att_rows = [
            ("s1", {"Brand": "A"}),
            ("s2", {"Brand": "A"}),
            ("s3", {"Brand": "B"}),
            ("s4", {"Brand": "B"}),
            ("s5", {}),  # no Brand key -> NULL attribute value
            ("p6", {"Brand": "C"}),
        ]
        for i, (sku, extra) in enumerate(att_rows, start=1):
            RawAttributesData.objects.create(
                metadata_id=self.att_dataset.id,
                case_id=self.case.id,
                version=1,
                row_num=i,
                data={"skuname_ean": sku, **extra},
            )

        matrix = {
            "s1": {"s1": "0", "s2": "1", "s3": "2", "s4": "3", "s5": "4"},
            "s2": {"s1": "1", "s2": "0", "s3": "5", "s4": "6", "s5": "7"},
            "s3": {"s1": "2", "s2": "5", "s3": "0", "s4": "8", "s5": "9"},
            "s4": {"s1": "3", "s2": "6", "s3": "8", "s4": "0", "s5": "x"},
            "s5": {"s1": "4", "s2": "7", "s3": "9", "s4": "10", "s5": "0"},
        }
        raw_buyers = {"s1": "20", "s2": "10", "s3": "30", "s4": "40", "s5": "50"}
        clients = {"s1", "s3"}
        for i, sku in enumerate(["s1", "s2", "s3", "s4", "s5"], start=1):
            RawCrossPurchaseData.objects.create(
                metadata_id=self.cp_dataset.id,
                case_id=self.case.id,
                version=1,
                row_num=i,
                data={
                    "category": "Pizza",
                    "total_base_buyers": "1000",
                    "raw_buyers": raw_buyers[sku],
                    "is_branded": "1",
                    "is_client": "1" if sku in clients else "0",
                    "skuname_ean": sku,
                    **matrix[sku],
                },
            )

    def test_overall_coverage_matches_hand_computed_values(self):
        self._seed_full_fixture()

        payload = compute_coverage(
            case_id=self.case.id, selected_skus=["s1", "s2", "s3"]
        )
        overall = payload["overall_coverage"]

        self.assertEqual(
            overall["total_pos"],
            {"skus": 5, "client_skus": 2, "value": 1500.0, "volume": 150.0},
        )

        sel = overall["current_selection"]
        self.assertEqual(sel["min_n_cutoff_selected"], 10.0)
        self.assertEqual(sel["skus"], 3)
        self.assertEqual(sel["client_skus"], 2)
        self.assertAlmostEqual(sel["pos_coverage_value_pct"], 40.0)
        self.assertAlmostEqual(sel["pos_coverage_volume_pct"], 40.0)
        self.assertAlmostEqual(sel["client_coverage_value_pct"], 100.0)
        self.assertAlmostEqual(sel["client_coverage_volume_pct"], 100.0)
        # 3x5 cells, all numeric, 3 zero diagonal cells.
        self.assertAlmostEqual(sel["percent_zeroes"], 3 / 15 * 100)

        panel = overall["all_panel_skus"]
        self.assertEqual(panel["min_n"], 10.0)
        self.assertEqual(panel["skus"], 5)
        self.assertEqual(panel["client_skus"], 2)
        # s5 has no POS row -> contributes 0 sales.
        self.assertAlmostEqual(panel["pos_coverage_value_pct"], 1000 / 1500 * 100)
        self.assertAlmostEqual(panel["pos_coverage_volume_pct"], 100 / 150 * 100)
        # 25 cells, one non-numeric ("x") excluded, 5 zero diagonal cells.
        self.assertAlmostEqual(panel["percent_zeroes"], 5 / 24 * 100)

    def test_attribute_coverage_splits_and_color_flags(self):
        self._seed_full_fixture()

        payload = compute_coverage(
            case_id=self.case.id, selected_skus=["s1", "s2", "s3"]
        )
        coverage = payload["coverage"]
        self.assertEqual(len(coverage), 1)
        brand = coverage[0]
        self.assertEqual(brand["id"], 1)
        self.assertEqual(brand["attribute"], "Brand")
        # Selection (A: 300, B: 300) diverges >10% from the panel's B: 700.
        self.assertEqual(brand["color_flag"], "YELLOW")

        details = brand["details"][0]

        custom = details["pos_sales_split_custom"]
        self.assertEqual(
            custom,
            [
                {
                    "sub_attribute": "A",
                    "skus_number": 2,
                    "pos_volume_covered": 100.0,
                    "pos_value_covered": 100.0,
                    "value_share": 50.0,
                    "volume_share": 50.0,
                },
                {
                    "sub_attribute": "B",
                    "skus_number": 1,
                    "pos_volume_covered": round(30 / 70 * 100, 3),
                    "pos_value_covered": round(300 / 700 * 100, 3),
                    "value_share": 50.0,
                    "volume_share": 50.0,
                },
            ],
        )

        by_value = {row["sub_attribute"]: row for row in details["pos_sales_split_panel"]}
        # C exists only in POS, s5's NULL brand is dropped by the join.
        self.assertEqual(set(by_value), {"A", "B"})
        self.assertEqual(by_value["A"]["value_share"], 30.0)
        self.assertEqual(by_value["B"]["value_share"], 70.0)
        self.assertEqual(by_value["B"]["pos_value_covered"], 100.0)

        pure = {row["sub_attribute"]: row for row in details["pos_sales_split"]}
        self.assertEqual(set(pure), {"A", "B", "C"})
        self.assertEqual(pure["C"]["skus_number"], 1)
        self.assertEqual(pure["A"]["value_share"], 20.0)
        self.assertEqual(pure["B"]["value_share"], round(700 / 1500 * 100, 3))
        self.assertEqual(pure["C"]["value_share"], round(500 / 1500 * 100, 3))

        # Selecting the whole panel makes the selection == panel -> GREEN.
        full = compute_coverage(
            case_id=self.case.id,
            selected_skus=["s1", "s2", "s3", "s4", "s5"],
        )
        self.assertEqual(full["coverage"][0]["color_flag"], "GREEN")

    def test_no_pos_rows_yields_red_flags_and_zero_percents(self):
        self._seed_full_fixture()
        RawPosData.objects.all().delete()

        payload = compute_coverage(case_id=self.case.id, selected_skus=["s1", "s2", "s3"])
        overall = payload["overall_coverage"]
        self.assertEqual(overall["total_pos"]["skus"], 0)
        self.assertEqual(overall["current_selection"]["pos_coverage_value_pct"], 0.0)
        self.assertEqual(payload["coverage"][0]["color_flag"], "RED")
        self.assertEqual(payload["coverage"][0]["details"][0]["pos_sales_split"], [])

    def test_zero_sales_yields_none_shares(self):
        self._seed_full_fixture()
        RawPosData.objects.all().update(
            data={
                "skuname_ean": "s1",
                "is_client": "0",
                "dollar_sales": "0",
                "volume_sales": "0",
            }
        )

        payload = compute_coverage(case_id=self.case.id, selected_skus=["s1", "s2", "s3"])
        pure = payload["coverage"][0]["details"][0]["pos_sales_split"]
        self.assertTrue(pure)
        self.assertIsNone(pure[0]["value_share"])
        self.assertIsNone(pure[0]["volume_share"])

    def test_empty_selection_is_safe(self):
        self._seed_full_fixture()

        payload = compute_coverage(case_id=self.case.id, selected_skus=[])
        sel = payload["overall_coverage"]["current_selection"]
        self.assertEqual(sel["skus"], 0)
        self.assertIsNone(sel["min_n_cutoff_selected"])
        self.assertEqual(sel["pos_coverage_value_pct"], 0.0)
        self.assertIsNone(sel["percent_zeroes"])

    def test_duplicate_pos_rows_sum_in_totals_but_first_wins_in_panel(self):
        self._seed_full_fixture()
        # A second POS row for s1: totals sum it, the panel join must not.
        RawPosData.objects.create(
            metadata_id=self.pos_dataset.id,
            case_id=self.case.id,
            version=1,
            row_num=99,
            data={
                "skuname_ean": "s1",
                "is_client": "1",
                "dollar_sales": "50",
                "volume_sales": "5",
            },
        )

        payload = compute_coverage(case_id=self.case.id, selected_skus=["s1", "s2", "s3"])
        overall = payload["overall_coverage"]
        # skus stays distinct (5+p6... 5 distinct), sums include the dupe.
        self.assertEqual(overall["total_pos"]["skus"], 5)
        self.assertEqual(overall["total_pos"]["value"], 1550.0)
        self.assertEqual(overall["total_pos"]["client_skus"], 3)
        # Selection sales still use the first s1 row only (100, not 150).
        self.assertAlmostEqual(
            overall["current_selection"]["pos_coverage_value_pct"], 600 / 1550 * 100
        )

    def test_returns_none_without_pos_or_cross_purchase_dataset(self):
        att = self._dataset(Dataset.Type.ATTRIBUTES, ["skuname_ean", "Brand"])
        cp = self._dataset(
            Dataset.Type.CROSS_PURCHASE, ["skuname_ean", "total_base_buyers"]
        )
        self.assertIsNone(
            compute_coverage(case_id=self.case.id, selected_skus=["s1", "s2", "s3"])
        )
        cp.is_selected = False
        cp.save(update_fields=["is_selected"])
        self._dataset(Dataset.Type.POS, ["skuname_ean", "dollar_sales"])
        self.assertIsNone(
            compute_coverage(case_id=self.case.id, selected_skus=["s1", "s2", "s3"])
        )

    def test_no_attributes_dataset_yields_empty_attribute_coverage(self):
        self._seed_full_fixture()
        self.att_dataset.is_selected = False
        self.att_dataset.save(update_fields=["is_selected"])

        payload = compute_coverage(case_id=self.case.id, selected_skus=["s1", "s2", "s3"])
        self.assertEqual(payload["coverage"], [])
        self.assertEqual(payload["overall_coverage"]["total_pos"]["skus"], 5)


class RoiWorkflowIntegrationTests(TestCase):
    """compute_roi_result carries coverage end-to-end into RoiLatestView."""

    def setUp(self):
        self.user = User.objects.create(
            entra_oid="oid-roi",
            tenant_id="tenant-1",
            email="roi-user@example.com",
        )
        self.case = Case.objects.create(
            name="Case",
            code="ROICASE",
            created_by=self.user,
            updated_by=self.user,
        )
        self.partition = Partition.objects.create(
            case=self.case,
            name="Partition",
            created_by=self.user,
            updated_by=self.user,
        )
        for dataset_type, columns in [
            (Dataset.Type.POS, ["skuname_ean", "is_client", "dollar_sales", "volume_sales"]),
            (Dataset.Type.ATTRIBUTES, ["skuname_ean", "Brand"]),
            (
                Dataset.Type.CROSS_PURCHASE,
                ["category", "total_base_buyers", "raw_buyers", "is_branded", "is_client", "skuname_ean", "s1", "s2", "s3"],
            ),
        ]:
            dataset = Dataset.objects.create(
                case=self.case,
                type=dataset_type,
                version=1,
                file_name=f"{dataset_type}.csv",
                blob_name=f"cases/{self.case.id}/datasets/{dataset_type}.csv",
                status=Dataset.Status.READY,
                is_selected=True,
                tags={"columns_order": columns},
                created_by=self.user,
            )
            setattr(self, f"{dataset_type.lower()}_dataset", dataset)

        self.skus = ["s1", "s2", "s3"]
        cells = {
            "s1": {"s1": "0", "s2": "10", "s3": "20"},
            "s2": {"s1": "10", "s2": "0", "s3": "30"},
            "s3": {"s1": "20", "s2": "30", "s3": "0"},
        }
        for i, sku in enumerate(self.skus, start=1):
            RawPosData.objects.create(
                metadata_id=self.pos_dataset.id,
                case_id=self.case.id,
                version=1,
                row_num=i,
                data={
                    "skuname_ean": sku,
                    "is_client": "1" if sku == "s1" else "0",
                    "dollar_sales": str(100 * i),
                    "volume_sales": str(10 * i),
                },
            )
            RawAttributesData.objects.create(
                metadata_id=self.attributes_dataset.id,
                case_id=self.case.id,
                version=1,
                row_num=i,
                data={"skuname_ean": sku, "Brand": "A" if i < 3 else "B"},
            )
            RawCrossPurchaseData.objects.create(
                metadata_id=self.cross_purchase_dataset.id,
                case_id=self.case.id,
                version=1,
                row_num=i,
                data={
                    "category": "Pizza",
                    "total_base_buyers": "1000",
                    "raw_buyers": str(10 * i),
                    "is_branded": "1",
                    "is_client": "1" if sku == "s1" else "0",
                    "skuname_ean": sku,
                    **cells[sku],
                },
            )

        self.metadata = create_ready_metadata(
            self.case,
            base=1000.0,
            sku_count=3,
            row_max={"s1": 20.0, "s2": 30.0, "s3": 30.0},
            avg_roi={"s1": 1.5, "s2": 2.0, "s3": 2.5},
            roi_matrix={
                "s1": {"s1": 0.0, "s2": 1.0, "s3": 2.0},
                "s2": {"s1": 1.0, "s2": 0.0, "s3": 3.0},
                "s3": {"s1": 2.0, "s2": 3.0, "s3": 0.0},
            },
        )
        self.workflow = WorkflowRun.objects.create(
            partition=self.partition,
            status=WorkflowRun.Status.COMPLETED,
            triggered_by=self.user,
            parameters={"selected_skus": self.skus},
        )

    def test_compute_roi_result_includes_coverage(self):
        from core.services.roi.analysis import compute_roi_result

        result = compute_roi_result(
            case_id=str(self.case.id),
            partition_id=str(self.partition.id),
            selected_skus=self.skus,
        )

        self.assertIn("sku_math", result)
        coverage = result["coverage"]
        self.assertIsNotNone(coverage)
        self.assertEqual(coverage["overall_coverage"]["total_pos"]["skus"], 3)
        self.assertEqual(
            [item["attribute"] for item in coverage["coverage"]], ["Brand"]
        )

        # include_coverage=False keeps the key out entirely.
        without = compute_roi_result(
            case_id=str(self.case.id),
            partition_id=str(self.partition.id),
            selected_skus=self.skus,
            include_coverage=False,
        )
        self.assertNotIn("coverage", without)

    def test_roi_latest_view_returns_coverage(self):
        workflow_store.set_sku_math(self.workflow, {"columns": [], "rows": [], "count": 0})
        workflow_store.set_coverage(self.workflow, {"overall_coverage": {}, "coverage": []})
        self.workflow.tags = {"roi_status": "completed", "roi_task_id": "t-1"}
        self.workflow.save(update_fields=["result", "tags"])

        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)
        response = RoiLatestView.as_view()(
            request, case_id=self.case.id, partition_id=self.partition.id
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "COMPLETED")
        self.assertEqual(
            response.data["result"]["coverage"], {"overall_coverage": {}, "coverage": []}
        )

    def test_preprocessing_status_ready_returns_200(self):
        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)
        response = PreprocessingStatusView.as_view()(request, case_id=self.case.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "READY")

    def test_preprocessing_status_running_returns_202(self):
        self.metadata.status = Metadata.Status.RUNNING
        self.metadata.save(update_fields=["status"])

        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)
        response = PreprocessingStatusView.as_view()(request, case_id=self.case.id)

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["status"], "RUNNING")


class DatasetPatchDedupTests(TestCase):
    """CaseDatasetDetailView.patch selects via the shared
    _select_and_ingest_dataset helper (no inlined duplicate flow)."""

    def setUp(self):
        self.user = User.objects.create(
            entra_oid="oid-patch",
            tenant_id="tenant-1",
            email="patch-user@example.com",
        )
        self.case = Case.objects.create(
            name="Case",
            code="PATCHCASE",
            created_by=self.user,
            updated_by=self.user,
        )
        self.dataset = Dataset.objects.create(
            case=self.case,
            type=Dataset.Type.POS,
            version=1,
            file_name="pos.csv",
            blob_name=f"cases/{self.case.id}/datasets/pos.csv",
            status=Dataset.Status.READY,
            created_by=self.user,
        )

    def _patch(self, body):
        request = APIRequestFactory().patch("/", body, format="json")
        force_authenticate(request, user=self.user)
        return CaseDatasetDetailView.as_view()(
            request, case_id=self.case.id, dataset_id=self.dataset.id
        )

    @patch("core.views.ingest_dataset")
    def test_select_patch_ingests_via_shared_helper(self, ingest):
        response = self._patch({"is_selected": True, "description": "latest"})

        self.assertEqual(response.status_code, 200)
        ingest.assert_called_once_with(self.dataset)
        self.dataset.refresh_from_db()
        self.assertTrue(self.dataset.is_selected)
        self.assertEqual(self.dataset.status, Dataset.Status.PROCESSING)
        self.assertEqual(self.dataset.description, "latest")

    @patch("core.views.ingest_dataset")
    def test_select_patch_surfaces_ingestion_error(self, ingest):
        ingest.side_effect = DatasetIngestionError("bad csv")

        response = self._patch({"is_selected": True})

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data["detail"], "bad csv")

    @patch("core.views.ingest_dataset")
    def test_deselect_patch_does_not_ingest(self, ingest):
        self.dataset.is_selected = True
        self.dataset.save(update_fields=["is_selected"])

        response = self._patch({"is_selected": False})

        self.assertEqual(response.status_code, 200)
        ingest.assert_not_called()
        self.dataset.refresh_from_db()
        self.assertFalse(self.dataset.is_selected)
        self.assertEqual(self.dataset.status, Dataset.Status.READY)


class CasePreprocessingFlowTests(TestCase):
    """Explicit Start Preprocessing / force-release-locks / partition-creation
    gating flow."""

    def setUp(self):
        self.publisher = User.objects.create(
            entra_oid="oid-pub",
            tenant_id="tenant-1",
            email="publisher@example.com",
            role="admin",
        )
        self.editor = User.objects.create(
            entra_oid="oid-editor",
            tenant_id="tenant-1",
            email="editor@example.com",
            role="editor",
        )
        self.case = Case.objects.create(
            name="Case",
            code="FLOWCASE",
            created_by=self.publisher,
            updated_by=self.publisher,
        )
        # editor gets a case-level EDITOR assignment (can create partitions /
        # edit datasets, but is NOT the publisher).
        CaseUserAssignment.objects.create(
            case=self.case, user=self.editor, role=CaseUserAssignment.Role.EDITOR
        )
        self.partition = Partition.objects.create(
            case=self.case,
            name="Partition",
            created_by=self.editor,
            updated_by=self.editor,
        )
        for dataset_type, columns in [
            (Dataset.Type.POS, ["skuname_ean", "dollar_sales"]),
            (Dataset.Type.ATTRIBUTES, ["skuname_ean", "Brand"]),
            (Dataset.Type.CROSS_PURCHASE, ["skuname_ean", "total_base_buyers"]),
        ]:
            Dataset.objects.create(
                case=self.case,
                type=dataset_type,
                version=1,
                file_name=f"{dataset_type}.csv",
                blob_name=f"cases/{self.case.id}/datasets/{dataset_type}.csv",
                status=Dataset.Status.READY,
                is_selected=True,
                tags={"columns_order": columns},
                created_by=self.publisher,
            )

    def _post(self, view, user, **kwargs):
        request = APIRequestFactory().post("/", {}, format="json")
        force_authenticate(request, user=user)
        return view(request, case_id=self.case.id, **kwargs)

    def _lock_partition(self, user):
        request = APIRequestFactory().post("/")
        force_authenticate(request, user=user)
        response = PartitionLockView.as_view()(
            request, case_id=self.case.id, partition_id=self.partition.id
        )
        self.assertEqual(response.status_code, 200)

    # --- CasePreprocessingRunView -------------------------------------

    @patch("core.views.preprocess_case_task")
    def test_run_dispatches_preprocessing_for_current_selection(self, task):
        response = self._post(CasePreprocessingRunView.as_view(), self.editor)

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["status"], "QUEUED")
        task.apply_async.assert_called_once_with(
            args=[str(self.case.id)], queue="preprocess"
        )

    @patch("core.views.preprocess_case_task")
    def test_run_blocked_by_active_lock(self, task):
        self._lock_partition(self.editor)

        response = self._post(CasePreprocessingRunView.as_view(), self.editor)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(len(response.data["locked_partitions"]), 1)
        self.assertEqual(
            response.data["locked_partitions"][0]["id"], str(self.partition.id)
        )
        task.apply_async.assert_not_called()

    def test_run_requires_edit_datasets_permission(self):
        viewer = User.objects.create(
            entra_oid="oid-viewer",
            tenant_id="tenant-1",
            email="viewer2@example.com",
            role="viewer",
        )
        response = self._post(CasePreprocessingRunView.as_view(), viewer)
        self.assertEqual(response.status_code, 403)

    # --- CasePartitionLocksReleaseView ---------------------------------

    def test_editor_cannot_release_locks(self):
        self._lock_partition(self.editor)

        response = self._post(CasePartitionLocksReleaseView.as_view(), self.editor)

        self.assertEqual(response.status_code, 403)
        self.partition.refresh_from_db()
        self.assertIsNotNone(self.partition.locked_by_id)

    def test_publisher_releases_all_locks(self):
        self._lock_partition(self.editor)

        response = self._post(CasePartitionLocksReleaseView.as_view(), self.publisher)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["released_count"], 1)
        self.partition.refresh_from_db()
        self.assertIsNone(self.partition.locked_by_id)
        self.assertIsNone(self.partition.lock_expires_at)

    @patch("core.views.preprocess_case_task")
    def test_publisher_release_then_run_succeeds(self, task):
        self._lock_partition(self.editor)
        release = self._post(CasePartitionLocksReleaseView.as_view(), self.publisher)
        self.assertEqual(release.status_code, 200)

        run = self._post(CasePreprocessingRunView.as_view(), self.editor)
        self.assertEqual(run.status_code, 202)
        task.apply_async.assert_called_once()

    # --- Partition creation gating --------------------------------------

    def test_partition_creation_blocked_until_case_ready(self):
        request = APIRequestFactory().post(
            "/", {"name": "New Partition"}, format="json"
        )
        force_authenticate(request, user=self.editor)
        response = CasePartitionsView.as_view()(request, case_id=self.case.id)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["status"], "NOT_STARTED")
        self.assertFalse(
            Partition.objects.filter(case=self.case, name="New Partition").exists()
        )

    def test_partition_creation_succeeds_once_ready(self):
        create_ready_metadata(self.case)

        request = APIRequestFactory().post(
            "/", {"name": "New Partition"}, format="json"
        )
        force_authenticate(request, user=self.editor)
        response = CasePartitionsView.as_view()(request, case_id=self.case.id)

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            Partition.objects.filter(case=self.case, name="New Partition").exists()
        )


class NodeTestingWorkflowTests(TestCase):
    """Per-node Base/Level Testing run→poll cycle and the OBM recompute
    dispatched by partition-tree mutations.

    ROI matrix (symmetric, zero diagonal): within-Brand pairs score 10 (A)
    and 12 (B), cross-Brand pairs score 2 — so Brand (and its clone
    BrandCopy) hold in base testing while Size (which mixes brands) does not.
    """

    def setUp(self):
        self.user = User.objects.create(
            entra_oid="oid-node",
            tenant_id="tenant-1",
            email="node-user@example.com",
        )
        self.case = Case.objects.create(
            name="Case",
            code="NODECASE",
            created_by=self.user,
            updated_by=self.user,
        )
        self.partition = Partition.objects.create(
            case=self.case,
            name="Partition",
            created_by=self.user,
            updated_by=self.user,
        )
        self.attr_dataset = self._dataset(
            Dataset.Type.ATTRIBUTES, ["skuname_ean", "Brand", "Size", "BrandCopy"]
        )
        self.cp_dataset = self._dataset(
            Dataset.Type.CROSS_PURCHASE,
            ["category", "total_base_buyers", "skuname_ean", "is_client"],
        )

        self.skus = ["s1", "s2", "s3", "s4"]
        attributes = {
            "s1": {"Brand": "A", "Size": "L", "BrandCopy": "A"},
            "s2": {"Brand": "A", "Size": "S", "BrandCopy": "A"},
            "s3": {"Brand": "B", "Size": "L", "BrandCopy": "B"},
            "s4": {"Brand": "B", "Size": "S", "BrandCopy": "B"},
        }
        for i, sku in enumerate(self.skus, start=1):
            RawAttributesData.objects.create(
                metadata_id=self.attr_dataset.id,
                case_id=self.case.id,
                version=1,
                row_num=i,
                data={"skuname_ean": sku, **attributes[sku]},
            )
            RawCrossPurchaseData.objects.create(
                metadata_id=self.cp_dataset.id,
                case_id=self.case.id,
                version=1,
                row_num=i,
                data={
                    "category": "Pizza",
                    "total_base_buyers": "1000",
                    "skuname_ean": sku,
                    "is_client": "1" if sku == "s1" else "0",
                },
            )

        def roi(left, right):
            if left == right:
                return 0.0
            same_brand = attributes[left]["Brand"] == attributes[right]["Brand"]
            if not same_brand:
                return 2.0
            return 10.0 if attributes[left]["Brand"] == "A" else 12.0

        self.metadata = create_ready_metadata(
            self.case,
            base=1000.0,
            sku_count=4,
            row_max={sku: 30.0 for sku in self.skus},
            avg_roi={sku: 5.0 for sku in self.skus},
            roi_matrix={
                left: {right: roi(left, right) for right in self.skus}
                for left in self.skus
            },
        )
        self.workflow = WorkflowRun.objects.create(
            partition=self.partition,
            status=WorkflowRun.Status.COMPLETED,
            triggered_by=self.user,
            parameters={"selected_skus": self.skus},
        )

    def _dataset(self, dataset_type, columns):
        return Dataset.objects.create(
            case=self.case,
            type=dataset_type,
            version=1,
            file_name=f"{dataset_type}.csv",
            blob_name=f"cases/{self.case.id}/datasets/{dataset_type}.csv",
            status=Dataset.Status.READY,
            is_selected=True,
            tags={"columns_order": columns},
            created_by=self.user,
        )

    def _root_id(self):
        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)
        response = PartitionWorkflowStatusView.as_view()(
            request, case_id=self.case.id, partition_id=self.partition.id
        )
        return response.data["data"]["partition_tree"]["nodes"][0]["id"]

    def test_run_node_testing_computes_base_and_level(self):
        from core.services.roi.node_testing import run_node_testing

        root_id = self._root_id()
        graph = workflow_store.get_partition_tree(
            workflow_store.get_partition_workflow(self.partition)
        )
        node = next(n for n in graph["nodes"] if n["id"] == root_id)

        result = run_node_testing(
            case_id=str(self.case.id),
            partition=self.partition,
            node=node,
            attributes=["Brand", "Size", "BrandCopy"],
        )

        summary = {
            row[2]: row[3] for row in result["base_testing"]["summary"]["rows"]
        }
        self.assertEqual(
            summary, {"Brand": "TRUE", "Size": "FALSE", "BrandCopy": "TRUE"}
        )

        items = {item["attribute"]: item for item in result["base_testing"]["items"]}
        self.assertEqual(set(items), {"Brand", "Size", "BrandCopy"})
        brand_rows = {row[2]: row for row in items["Brand"]["rows"]}
        self.assertTrue(brand_rows["A"][0])
        self.assertEqual(brand_rows["A"][1], 2)  # two SKUs per brand value
        # Mean within-A ROI is 10, cross-brand 2.
        self.assertEqual(items["Brand"]["columns"][:3], ["", 4, "Brand"])

        # Only Brand + BrandCopy pass base testing, so level testing ranks
        # exactly those two.
        lhs_attributes = {row[2] for row in result["level_testing"]["lhs"]["rows"]}
        self.assertEqual(lhs_attributes, {"Brand", "BrandCopy"})

    def test_run_endpoint_and_poll_cycle(self):
        from core.tasks import compute_node_testing_task

        root_id = self._root_id()
        attrs_payload = {
            "node_obj": {"id": root_id, "path": []},
            "attrs_list": {
                "columns": ["is_selected", "attribute_name", "values"],
                "rows": [
                    [True, "Brand", None],
                    [False, "Size", None],
                ],
            },
        }

        captured = {}

        def fake_apply_async(args, queue):
            captured["args"] = args
            captured["queue"] = queue
            return type("T", (), {"id": "task-node-1"})()

        with patch(
            "core.views.compute_node_testing_task"
        ) as task_mock:
            task_mock.apply_async.side_effect = fake_apply_async
            request = APIRequestFactory().post("/", attrs_payload, format="json")
            force_authenticate(request, user=self.user)
            response = PartitionWorkflowProcessRunView.as_view()(
                request,
                case_id=self.case.id,
                partition_id=self.partition.id,
                process_name="process_partition_tree",
            )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["status"], "QUEUED")
        self.assertEqual(captured["args"][1], root_id)
        self.assertEqual(captured["args"][2], ["Brand"])

        # Execute the queued work eagerly, then poll the node.
        compute_node_testing_task.apply(args=captured["args"]).get()

        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)
        poll = PartitionTreeNodeView.as_view()(
            request,
            case_id=self.case.id,
            partition_id=self.partition.id,
            node_id=root_id,
        )
        self.assertEqual(poll.status_code, 200)
        self.assertEqual(poll.data["status"], "COMPLETED")
        base_testing = poll.data["data"]["base_testing"]
        self.assertEqual(
            [row[2] for row in base_testing["summary"]["rows"]], ["Brand"]
        )

    def test_unknown_process_name_rejected(self):
        request = APIRequestFactory().post("/", {}, format="json")
        force_authenticate(request, user=self.user)
        response = PartitionWorkflowProcessRunView.as_view()(
            request,
            case_id=self.case.id,
            partition_id=self.partition.id,
            process_name="mystery_process",
        )
        self.assertEqual(response.status_code, 400)

    def test_attribute_select_queues_obm_recompute(self):
        from core.tasks import compute_obm_task

        root_id = self._root_id()

        with patch("core.views.compute_obm_task") as task_mock:
            task_mock.apply_async.return_value = type("T", (), {"id": "task-obm-1"})()
            request = APIRequestFactory().post(
                "/", {"attribute_name": "Brand"}, format="json"
            )
            force_authenticate(request, user=self.user)
            response = PartitionTreeNodeView.as_view()(
                request,
                case_id=self.case.id,
                partition_id=self.partition.id,
                node_id=root_id,
            )

        self.assertEqual(response.status_code, 200)
        task_mock.apply_async.assert_called_once()
        self.assertEqual(response.data["obm_task_id"], "task-obm-1")
        self.assertEqual(response.data["data"]["partition_obm"]["status"], "queued")

        # Run the recompute for real: two Brand leaves whose within-leaf ROI
        # beats cross-leaf ROI, so OBM holds.
        compute_obm_task.apply(args=[str(self.workflow.id)]).get()
        self.workflow.refresh_from_db()
        obm = workflow_store.get_obm(self.workflow)
        self.assertTrue(obm["obm_holds"])
        self.assertEqual(self.workflow.tags["obm_status"], "completed")

        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)
        status_response = PartitionWorkflowStatusView.as_view()(
            request, case_id=self.case.id, partition_id=self.partition.id
        )
        obm_step = status_response.data["data"]["partition_obm"]
        self.assertEqual(obm_step["status"], "completed")
        self.assertTrue(obm_step["result"]["obm_holds"])

    def test_delete_children_queues_obm_recompute(self):
        root_id = self._root_id()

        with patch("core.views.compute_obm_task") as task_mock:
            task_mock.apply_async.return_value = type("T", (), {"id": "task-obm-2"})()
            request = APIRequestFactory().post(
                "/", {"attribute_name": "Brand"}, format="json"
            )
            force_authenticate(request, user=self.user)
            PartitionTreeNodeView.as_view()(
                request,
                case_id=self.case.id,
                partition_id=self.partition.id,
                node_id=root_id,
            )

            delete_request = APIRequestFactory().delete("/")
            force_authenticate(delete_request, user=self.user)
            response = PartitionTreeNodeView.as_view()(
                delete_request,
                case_id=self.case.id,
                partition_id=self.partition.id,
                node_id=root_id,
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(task_mock.apply_async.call_count, 2)
        self.assertEqual(response.data["task_id"], "task-obm-2")
        self.assertEqual(response.data["data"]["partition_obm"]["status"], "queued")
