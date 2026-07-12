from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from core.models import (
    Case,
    Dataset,
    Partition,
    RawAttributesData,
    RawCrossPurchaseData,
    RawPosData,
    User,
    WorkflowRun,
)
from core.services.ingestion import DatasetIngestionError, ingest_dataset
from core.services.sku_selection import get_sku_selection_payload
from core.views import (
    CaseDatasetPreviewView,
    PartitionSkuSelectionView,
    PartitionTreeAttributeSelectionView,
    PartitionTreeNodeColorsView,
    PartitionTreeNodeView,
    PartitionWorkflowStatusView,
)


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

    def test_dataset_preview_returns_headers_and_first_5_rows(self):
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
        for i in range(1, 10):
            RawPosData.objects.create(
                metadata_id=dataset.id,
                case_id=self.case.id,
                version=1,
                row_num=i,
                data={"SKU": f"SKU-{i}", "Sales": str(10 * i)},
            )

        request = APIRequestFactory().get("/")
        force_authenticate(request, user=self.user)

        response = CaseDatasetPreviewView.as_view()(
            request,
            case_id=self.case.id,
            dataset_id=dataset.id,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["columns"], ["SKU", "Sales"])
        self.assertEqual(len(response.data["rows"]), 5)
        self.assertEqual(response.data["rows"][0]["SKU"], "SKU-1")
        self.assertEqual(response.data["rows"][4]["SKU"], "SKU-5")

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
        # Exactly two top-level keys; visualization is present (null until run).
        self.assertEqual(set(data), {"visualization", "partition_tree"})
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
