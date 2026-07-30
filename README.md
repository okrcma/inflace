# Inflace v Česku

**Live site: <https://okrcma.github.io/inflace/>**

A static calculator of Czech inflation between any two months since 2015,
based on the consumer price index published by the Czech Statistical
Office (ČSÚ): total inflation, average annual rate, a history chart, and a
per-COICOP-category breakdown.

This project is completely vibe-coded.

## How it works

- `tools/fetch_cpi.py` runs once a day via GitHub Actions: it queries the
  ČSÚ DataStat API (dataset CEN0101E, JSON-STAT) for the monthly CPI base
  index — average of 2025 = 100, total plus 13 COICOP divisions, 2015-01
  onward — and writes `data/cpi.json`. The file is only rewritten when the
  data actually changed (the index updates monthly, so most runs are no-ops).
- The site is vanilla HTML/CSS/JS with no dependencies and no third-party
  requests of any kind (no CDNs, fonts, or analytics). All statistics are
  computed in the browser by `math.js`:
  `inflation = (index_end / index_start − 1) × 100`.
- Tests: `python3 -m unittest discover -s tests` (offline, fixture-based)
  and `node tests/test_math.js` — both pin the reference value
  01/2018 → 01/2024 = 43.18 %.

## Running locally

```sh
python3 -m http.server 8000
```

and open <http://localhost:8000/>. Opening `index.html` directly doesn't
work: the page loads `data/cpi.json` via `fetch()`, which browsers block
on `file://`.

## Data source

**Český statistický úřad** — dataset
[CEN0101E](https://data.csu.gov.cz/datastat/info/SADA/CEN0101E)
(Indexy spotřebitelských cen podle klasifikace COICOP 2018), fetched from
the DataStat API at `data.csu.gov.cz`. License
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) per the ČSÚ
[terms of use](https://csu.gov.cz/podminky_pro_vyuzivani_a_dalsi_zverejnovani_statistickych_udaju_csu).
Details: [`data/ATTRIBUTION.md`](data/ATTRIBUTION.md).

Unofficial project; not operated or endorsed by ČSÚ. All data is
informational only and may be out of date.
