import contextlib
import io
import json
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "tools"))
import fetch_cpi

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "cpi.jsonstat.json"


def fixture_text():
    return FIXTURE.read_text(encoding="utf-8")


class ParseTest(unittest.TestCase):
    def setUp(self):
        self.parsed = fetch_cpi.parse_jsonstat(fixture_text())

    def test_months_sorted_and_complete(self):
        months = self.parsed["months"]
        self.assertEqual(months[0], "2015-01")
        self.assertEqual(months, sorted(months))
        self.assertGreaterEqual(len(months), 138)

    def test_categories_total_first_with_names(self):
        categories = self.parsed["categories"]
        self.assertEqual(list(categories)[0], "0")
        self.assertEqual(categories["0"], "Úhrn")
        self.assertEqual(len(categories), 14)

    def test_pinned_reference_values(self):
        total = self.parsed["series"]["0"]
        self.assertAlmostEqual(total["2018-01"], 67.4, places=1)
        self.assertAlmostEqual(total["2024-01"], 96.5, places=1)
        # The 43.18 % pin carried over from the reference implementation:
        # (96.5 / 67.4 - 1) * 100, guarded here against parser drift.
        inflation = (total["2024-01"] / total["2018-01"] - 1.0) * 100.0
        self.assertAlmostEqual(inflation, 43.18, places=2)

    def test_months_equal_total_series_coverage(self):
        # The frontend assumes every listed month has a total value (chart
        # scales, default range); the parser must guarantee it.
        self.assertEqual(self.parsed["months"],
                         sorted(self.parsed["series"]["0"]))
        months = set(self.parsed["months"])
        for code, series in self.parsed["series"].items():
            self.assertTrue(set(series) <= months, code)

    def test_month_with_null_total_is_dropped_everywhere(self):
        doc = json.loads(fixture_text())
        # Null out the last month's total (categories keep their values),
        # as when ČSÚ publishes a month row before the totals land.
        last_month = max(doc["dimension"]["CasM"]["category"]["index"],
                         key=doc["dimension"]["CasM"]["category"]["index"].get)
        n_cat = doc["size"][doc["id"].index("CZCOICOP2")]
        t_idx = doc["dimension"]["CasM"]["category"]["index"][last_month]
        doc["value"][t_idx * n_cat + 0] = None  # category stride is 1, "0" first
        parsed = fetch_cpi.parse_jsonstat(json.dumps(doc))
        self.assertNotIn(last_month, parsed["months"])
        for code, series in parsed["series"].items():
            self.assertNotIn(last_month, series, code)

    def test_rejects_missing_total_series(self):
        doc = json.loads(fixture_text())
        coicop = doc["dimension"]["CZCOICOP2"]["category"]
        t_pos = coicop["index"]["0"] if isinstance(coicop["index"], dict) else 0
        n_cat = doc["size"][doc["id"].index("CZCOICOP2")]
        for i in range(len(doc["value"])):
            if i % n_cat == t_pos:
                doc["value"][i] = None
        with self.assertRaises(ValueError):
            fetch_cpi.parse_jsonstat(json.dumps(doc))

    def test_rejects_missing_dimension(self):
        doc = json.loads(fixture_text())
        doc["id"] = [i for i in doc["id"] if i != "CasM"]
        doc["size"] = doc["size"][:-2] + doc["size"][-1:]
        with self.assertRaises(ValueError):
            fetch_cpi.parse_jsonstat(json.dumps(doc))

    def test_rejects_unexpected_extra_dimension(self):
        doc = json.loads(fixture_text())
        doc["size"][0] = 2  # IndicatorType suddenly non-singleton
        with self.assertRaises(ValueError):
            fetch_cpi.parse_jsonstat(json.dumps(doc))


class OutputTest(unittest.TestCase):
    def setUp(self):
        self.parsed = fetch_cpi.parse_jsonstat(fixture_text())
        self.output = fetch_cpi.build_output(self.parsed, updated="2026-07-30T00:00:00Z")

    def test_output_shape(self):
        self.assertEqual(self.output["source"], fetch_cpi.DATASTAT_URL)
        self.assertEqual(self.output["updated"], "2026-07-30T00:00:00Z")
        self.assertEqual(self.output["months"], self.parsed["months"])
        self.assertEqual(self.output["categories"], self.parsed["categories"])
        self.assertEqual(self.output["series"], self.parsed["series"])

    def test_data_changed_ignores_timestamp(self):
        old_text = json.dumps(self.output, ensure_ascii=False)
        same = fetch_cpi.build_output(self.parsed, updated="2027-01-01T00:00:00Z")
        self.assertFalse(fetch_cpi.data_changed(old_text, same))

    def test_data_changed_detects_new_data(self):
        old_text = json.dumps(self.output, ensure_ascii=False)
        changed = json.loads(json.dumps(self.output))
        changed["series"]["0"]["2018-01"] = 67.5
        self.assertTrue(fetch_cpi.data_changed(old_text, changed))
        self.assertTrue(fetch_cpi.data_changed(None, self.output))
        self.assertTrue(fetch_cpi.data_changed("not json", self.output))


class MainTest(unittest.TestCase):
    def test_writes_then_reports_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = pathlib.Path(tmp) / "cpi.json"
            log = io.StringIO()
            with contextlib.redirect_stdout(log):
                self.assertEqual(
                    fetch_cpi.main(["--jsonstat", str(FIXTURE), "--out", str(out)]), 0)
            first = out.read_text(encoding="utf-8")
            doc = json.loads(first)
            self.assertAlmostEqual(doc["series"]["0"]["2024-01"], 96.5, places=1)
            self.assertTrue(first.endswith("\n"))
            self.assertIn("updated", log.getvalue())

            log = io.StringIO()
            with contextlib.redirect_stdout(log):
                self.assertEqual(
                    fetch_cpi.main(["--jsonstat", str(FIXTURE), "--out", str(out)]), 0)
            self.assertEqual(out.read_text(encoding="utf-8"), first)
            self.assertIn("unchanged", log.getvalue())


if __name__ == "__main__":
    unittest.main()
