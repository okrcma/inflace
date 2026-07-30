"use strict";

/* Inflation math over CPI index series. Pure functions, no I/O, no DOM —
   loaded by the page before app.js and by node in tests/test_math.js. */

const InflaceMath = {
  monthsBetween(start, end) {
    const [sy, sm] = start.split("-").map(Number);
    const [ey, em] = end.split("-").map(Number);
    return (ey - sy) * 12 + (em - sm);
  },

  inflationPct(series, start, end) {
    return (series[end] / series[start] - 1) * 100;
  },

  annualizedPct(series, start, end) {
    const ratio = series[end] / series[start];
    return (ratio ** (12 / InflaceMath.monthsBetween(start, end)) - 1) * 100;
  },

  /* Like inflationPct, but null when either month is missing from the
     series (category series can be shorter than the total). */
  categoryPct(series, start, end) {
    if (series[start] === undefined || series[end] === undefined) return null;
    return InflaceMath.inflationPct(series, start, end);
  },
};

if (typeof module !== "undefined") module.exports = InflaceMath;
