#!/usr/bin/env python3
"""Fetch the ČSÚ CPI dataset and build data/cpi.json for the static site.

One POST to the ČSÚ DataStat API (dataset CEN0101E, JSON-STAT) returns the
monthly consumer price base index (average 2025 = 100) for the total and the
13 COICOP divisions, 2015-01 onward. The response is parsed into a compact
JSON file consumed by the frontend, which computes all statistics client-side.
The output file is rewritten only when the data actually changed, so a no-op
run leaves the git tree clean.

Stdlib only. Makes exactly one request (none with --jsonstat).

API contract verified 2026-07-15 (see CLAUDE.md "API gotchas"): the
verzeSady=1 query param is mandatory, and the default rozsah must be kept so
the table filters apply.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DATASTAT_URL = (
    "https://data.csu.gov.cz/api/dotaz/v1/data/sady/CEN0101E/vlastni"
    "?format=JSON_STAT&verzeSady=1"
)
_DIM = {"razeni": "vychozi", "popis": "nazev"}
QUERY_BODY = {
    "radky": [{"kodDimenze": "CasM", **_DIM}],
    "sloupce": [{"kodDimenze": "CZCOICOP2", **_DIM, "rozbalitUroven": "CZCOP1"}],
    "filtryTabulky": [
        {"kodDimenze": "IndicatorType", **_DIM, "filtrTabulkyKod": "6134"},
        {"kodDimenze": "TYPUDAJE4A", **_DIM, "filtrTabulkyKod": "IZ2025"},
        {"kodDimenze": "UZ02P", **_DIM, "filtrTabulkyKod": "CZ"},
        {"kodDimenze": "EKAKTIOCDS", **_DIM, "filtrTabulkyKod": "0"},
    ],
}
# Per repo rules: generic User-Agent, no identifying information outbound.
USER_AGENT = "personal research tool"
REPO_ROOT = Path(__file__).resolve().parent.parent

_TIME_DIM = "CasM"
_CATEGORY_DIM = "CZCOICOP2"
TOTAL_CODE = "0"


def _index_map(category):
    index = category["index"]
    if isinstance(index, list):
        return {code: i for i, code in enumerate(index)}
    return dict(index)


def parse_jsonstat(text):
    """Parse the DataStat JSON-STAT response.

    Fails loudly on any shape drift so bad data breaks CI instead of
    reaching the published site.
    """
    doc = json.loads(text)
    ids = doc["id"]
    sizes = doc["size"]
    values = doc["value"]
    if not isinstance(values, list):
        raise ValueError("sparse JSON-STAT value object; expected dense list")

    strides = {}
    stride = 1
    for dim_id, size in zip(reversed(ids), reversed(sizes)):
        strides[dim_id] = stride
        stride *= size

    for dim_id in (_TIME_DIM, _CATEGORY_DIM):
        if dim_id not in ids:
            raise ValueError(f"missing dimension {dim_id!r}")
    for dim_id, size in zip(ids, sizes):
        if dim_id not in (_TIME_DIM, _CATEGORY_DIM) and size != 1:
            raise ValueError(f"unexpected non-singleton dimension {dim_id!r}")

    time_cat = doc["dimension"][_TIME_DIM]["category"]
    coicop_cat = doc["dimension"][_CATEGORY_DIM]["category"]
    time_pos = _index_map(time_cat)
    coicop_pos = _index_map(coicop_cat)

    months = sorted(time_pos)
    categories = {
        code: coicop_cat["label"][code]
        for code in sorted(coicop_pos, key=coicop_pos.get)
    }

    series = {}
    for code, cpos in coicop_pos.items():
        per_month = {}
        for month in months:
            value = values[cpos * strides[_CATEGORY_DIM]
                           + time_pos[month] * strides[_TIME_DIM]]
            if value is not None:
                per_month[month] = float(value)
        series[code] = per_month

    # The frontend assumes every listed month has a total value (chart
    # scales, default range). A month whose total is still null — as when
    # ČSÚ publishes a month row before the values land — is dropped from
    # every series rather than shipped as a NaN page.
    total = series.get(TOTAL_CODE)
    if not total:
        raise ValueError(f"missing total series {TOTAL_CODE!r}")
    months = [m for m in months if m in total]
    series = {code: {m: v for m, v in per_month.items() if m in total}
              for code, per_month in series.items()}
    return {"months": months, "categories": categories, "series": series}


def build_output(parsed, updated):
    return {
        "source": DATASTAT_URL,
        "updated": updated,
        "months": parsed["months"],
        "categories": parsed["categories"],
        "series": parsed["series"],
    }


def data_changed(old_text, new_output):
    """True if new_output differs from the previously written JSON, ignoring
    the `updated` timestamp (so unchanged data never dirties the git tree)."""
    if not old_text:
        return True
    try:
        old = json.loads(old_text)
    except json.JSONDecodeError:
        return True
    return any(old.get(key) != new_output[key]
               for key in ("source", "months", "categories", "series"))


def fetch_jsonstat(timeout=60, retries=1):
    request = urllib.request.Request(
        DATASTAT_URL,
        data=json.dumps(QUERY_BODY).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
        method="POST",
    )
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read().decode("utf-8")
        except OSError as exc:
            # 4xx (except 429) means the request itself is wrong — a retry
            # can never succeed and just re-hits the source.
            deterministic = (isinstance(exc, urllib.error.HTTPError)
                             and exc.code < 500 and exc.code != 429)
            if deterministic or attempt == retries:
                raise
            time.sleep(10)  # one gentle retry keeps transient 5xx out of CI noise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--jsonstat", type=Path,
                        help="read the JSON-STAT response from a local file")
    parser.add_argument("--out", type=Path, default=REPO_ROOT / "data" / "cpi.json")
    args = parser.parse_args(argv)

    text = (args.jsonstat.read_text(encoding="utf-8") if args.jsonstat
            else fetch_jsonstat())
    parsed = parse_jsonstat(text)
    updated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    output = build_output(parsed, updated=updated)

    old_text = args.out.read_text(encoding="utf-8") if args.out.exists() else None
    summary = (f"{len(parsed['months'])} months "
               f"({parsed['months'][0]}..{parsed['months'][-1]}), "
               f"{len(parsed['categories'])} categories")
    if not data_changed(old_text, output):
        print(f"{args.out}: unchanged ({summary})")
        return 0
    tmp = args.out.with_name(args.out.name + ".tmp")
    tmp.write_text(json.dumps(output, ensure_ascii=False, indent=1) + "\n",
                   encoding="utf-8")
    os.replace(tmp, args.out)
    print(f"{args.out}: updated — {summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
