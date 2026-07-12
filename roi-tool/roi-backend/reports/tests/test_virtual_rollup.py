from django.test import SimpleTestCase

from reports.services.workflow.virtual_rollup import normalize_grouping_spec


class VirtualRollupGroupingSpecTests(SimpleTestCase):
    def test_accepts_mapping_payload(self):
        spec = {
            "Mainstream": ["Value", "Mid Tier"],
            "Premium": ["Premium"],
        }

        self.assertEqual(
            normalize_grouping_spec(spec),
            {
                "Mainstream": ["Value", "Mid Tier"],
                "Premium": ["Premium"],
            },
        )

    def test_accepts_array_payload(self):
        spec = [
            {"name": "Mainstream", "values": ["Value", "Mid Tier"]},
            {"label": "Premium", "old_values": ["Premium"]},
        ]

        self.assertEqual(
            normalize_grouping_spec(spec),
            {
                "Mainstream": ["Value", "Mid Tier"],
                "Premium": ["Premium"],
            },
        )

    def test_keeps_legacy_string_payload(self):
        self.assertEqual(
            normalize_grouping_spec(
                "[Value | Mid Tier, Premium]",
                grouping_labels={"Value | Mid Tier": "Mainstream"},
            ),
            {
                "Mainstream": ["Value", "Mid Tier"],
                "Premium": ["Premium"],
            },
        )

    def test_rejects_duplicate_source_values(self):
        with self.assertRaisesRegex(ValueError, "mapped to both"):
            normalize_grouping_spec(
                {
                    "Mainstream": ["Value", "Mid Tier"],
                    "Discount": ["Value"],
                }
            )

    def test_rejects_non_list_mapping_values(self):
        with self.assertRaisesRegex(ValueError, "must be a list"):
            normalize_grouping_spec({"Mainstream": "Value | Mid Tier"})
