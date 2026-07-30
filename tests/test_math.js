"use strict";
/* Tests for the frontend math module (math.js), run with: node tests/test_math.js
   Pinned reference values match tests/test_fetch_cpi.py and the reference
   implementation: 2018-01 (67.4) -> 2024-01 (96.5) = 43.18 %, 6.16 %/yr. */
const assert = require("node:assert");
const M = require("../math.js");

const total = { "2018-01": 67.4, "2024-01": 96.5 };
const near = (a, b, eps = 0.005) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

assert.strictEqual(M.monthsBetween("2018-01", "2024-01"), 72);
assert.strictEqual(M.monthsBetween("2018-01", "2018-02"), 1);

near(M.inflationPct(total, "2018-01", "2024-01"), 43.18);
near(M.annualizedPct(total, "2018-01", "2024-01"), 6.16);
near(M.inflationPct({ "2020-01": 100.0, "2020-02": 100.0 }, "2020-01", "2020-02"), 0.0);

assert.strictEqual(M.categoryPct({ "2018-01": 67.4 }, "2018-01", "2024-01"), null);
assert.strictEqual(M.categoryPct({}, "2018-01", "2024-01"), null);
near(M.categoryPct(total, "2018-01", "2024-01"), 43.18);

console.log("test_math.js: all assertions passed");
