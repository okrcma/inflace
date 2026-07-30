# Data sources and licensing

## cpi.json — consumer price index

- **Source:** Český statistický úřad (ČSÚ / Czech Statistical Office),
  dataset [CEN0101E](https://data.csu.gov.cz/datastat/info/SADA/CEN0101E)
  — "Indexy spotřebitelských cen podle klasifikace COICOP 2018", monthly
  base index (average of 2025 = 100), total plus 13 COICOP divisions,
  2015-01 onward. Fetched from the DataStat API at `data.csu.gov.cz` by
  `tools/fetch_cpi.py` (also as the committed test fixture
  `tests/fixtures/cpi.jsonstat.json`).
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
  per the ČSÚ
  [terms of use](https://csu.gov.cz/podminky_pro_vyuzivani_a_dalsi_zverejnovani_statistickych_udaju_csu)
  (verified 2026-07-30). Conditions: cite "Český statistický úřad" as the
  source, link the terms when redistributing, do not distort the meaning of
  the data, and do not imply ČSÚ endorses this project.
- **Processing:** the JSON-STAT response is reshaped 1:1 into
  `{months, categories, series}`; index values are unmodified. All derived
  statistics (inflation percentages) are computed in the visitor's browser.

This project is unofficial and is not operated or endorsed by ČSÚ.
