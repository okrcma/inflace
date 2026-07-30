"use strict";

/* Inflace v Česku — static frontend. Data comes from the committed
   data/cpi.json; all statistics are computed client-side via math.js. */

const TOTAL_CODE = "0";
const SVG_NS = "http://www.w3.org/2000/svg";

const CHART = { w: 800, h: 280, left: 46, right: 14, top: 12, bottom: 30 };

const MONTHS_GENITIVE = [
  "ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince",
];

const fmtPct1 = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtPct2 = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtIndex = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtCzk = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });
const fmtMonth = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" });
const fmtDate = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

const el = (id) => document.getElementById(id);

const state = {
  months: [],
  categories: {},   // code -> name
  series: {},       // code -> month -> index value
  total: {},        // month -> index value
  start: null,
  end: null,
};

function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return fmtMonth.format(new Date(y, m - 1, 1));
}

function monthLabelGenitive(month) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_GENITIVE[m - 1]} ${y}`;
}

function signedPct(value, fmt = fmtPct1) {
  const abs = fmt.format(Math.abs(value));
  if (/^0([.,]0+)?$/.test(abs)) return `${abs} %`;  // ±ε rounds to plain zero
  return value > 0 ? `+${abs} %` : `${fmt.format(value)} %`;
}

function periodLengthText(months) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearWord = years === 1 ? "rok" : years <= 4 ? "roky" : "let";
  const monthWord = rest === 1 ? "měsíc" : rest <= 4 ? "měsíce" : "měsíců";
  if (years === 0) return `${rest} ${monthWord}`;
  if (rest === 0) return `${years} ${yearWord}`;
  return `${years} ${yearWord} ${rest} ${monthWord}`;
}

/* ---------- boot ---------- */

async function boot() {
  el("error-screen").hidden = true;
  el("app").hidden = false;
  let data;
  try {
    const response = await fetch("data/cpi.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    showErrorScreen(
      `Data se nepodařilo načíst (${error.message}). ` +
      "Otevíráte-li stránku lokálně, spusťte ji přes malý HTTP server.");
    return;
  }
  state.months = data.months;
  state.categories = data.categories;
  state.series = data.series;
  state.total = data.series[TOTAL_CODE];
  el("updated").textContent = fmtDate.format(new Date(data.updated));

  initControls();
  drawChartBase();
  update();
}

function showErrorScreen(message) {
  el("app").hidden = true;
  const screen = el("error-screen");
  screen.hidden = false;
  el("error-message").textContent = message;
}

el("retry-button").addEventListener("click", boot);

function initControls() {
  const params = new URLSearchParams(location.search);
  const fromUrl = (key) => {
    const value = params.get(key);
    return state.months.includes(value) ? value : null;
  };
  state.start = fromUrl("start") || state.months[Math.max(0, state.months.length - 13)];
  state.end = fromUrl("end") || state.months[state.months.length - 1];
}

/* ---------- month picker ---------- */

const MONTHS_SHORT = [
  "led", "úno", "bře", "dub", "kvě", "čvn",
  "čvc", "srp", "zář", "říj", "lis", "pro",
];

// target: "start" | "end" | null; view: month grid or year-selection grid
const picker = { target: null, year: 0, view: "months" };

function togglePicker(target) {
  if (picker.target === target) closePicker();
  else openPicker(target);
}

function openPicker(target) {
  closePicker();
  picker.target = target;
  picker.year = Number(state[target].slice(0, 4));
  picker.view = "months";
  renderPicker();

  const popup = el("month-popup");
  const button = el(`${target}-button`);
  popup.hidden = false;
  const maxLeft = popup.offsetParent.clientWidth - popup.offsetWidth - 8;
  popup.style.left = `${Math.max(8, Math.min(button.offsetLeft, maxLeft))}px`;
  popup.style.top = `${button.offsetTop + button.offsetHeight + 6}px`;
  button.setAttribute("aria-expanded", "true");
}

function closePicker() {
  if (!picker.target) return;
  el(`${picker.target}-button`).setAttribute("aria-expanded", "false");
  picker.target = null;
  el("month-popup").hidden = true;
}

function renderPicker() {
  const minYear = Number(state.months[0].slice(0, 4));
  const maxYear = Number(state.months[state.months.length - 1].slice(0, 4));
  picker.year = Math.max(minYear, Math.min(maxYear, picker.year));
  const yearLabel = el("popup-year-label");
  yearLabel.textContent = picker.year;
  yearLabel.setAttribute("aria-label", `Vybrat rok (zvolen ${picker.year})`);
  yearLabel.setAttribute("aria-expanded", picker.view === "years");
  el("year-prev").disabled = picker.view === "years" || picker.year <= minYear;
  el("year-next").disabled = picker.view === "years" || picker.year >= maxYear;

  const grid = el("month-grid");
  grid.replaceChildren();

  if (picker.view === "years") {
    for (let y = minYear; y <= maxYear; y++) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = y;
      if (y === picker.year) {
        button.classList.add("selected");
        button.setAttribute("aria-current", "true");
      }
      button.addEventListener("click", () => {
        picker.year = y;
        picker.view = "months";
        renderPicker();
      });
      grid.append(button);
    }
    return;
  }

  const available = new Set(state.months);
  for (let m = 0; m < 12; m++) {
    const value = `${picker.year}-${String(m + 1).padStart(2, "0")}`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = MONTHS_SHORT[m];
    button.setAttribute("aria-label", monthLabel(value));
    // Unavailable months and choices that would reverse the range are
    // unselectable, so the picker can't produce an invalid state.
    button.disabled = !available.has(value) ||
      (picker.target === "start" ? value >= state.end : value <= state.start);
    if (value === state[picker.target]) {
      button.classList.add("selected");
      button.setAttribute("aria-current", "true");
    }
    button.addEventListener("click", () => {
      const opener = el(`${picker.target}-button`);
      state[picker.target] = value;
      closePicker();
      opener.focus();
      update();
    });
    grid.append(button);
  }
}

el("start-button").addEventListener("click", () => togglePicker("start"));
el("end-button").addEventListener("click", () => togglePicker("end"));
el("year-prev").addEventListener("click", () => { picker.year--; renderPicker(); });
el("year-next").addEventListener("click", () => { picker.year++; renderPicker(); });
el("popup-year-label").addEventListener("click", () => {
  picker.view = picker.view === "years" ? "months" : "years";
  renderPicker();
});

document.addEventListener("pointerdown", (event) => {
  if (!picker.target) return;
  if (event.target.closest(".month-popup, .month-button")) return;
  closePicker();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && picker.target) {
    const opener = el(`${picker.target}-button`);
    closePicker();
    opener.focus();
  }
});

/* ---------- result + categories ---------- */

function update() {
  const { start, end } = state;
  const inputError = el("input-error");

  for (const [target, caption] of [["start", "Od"], ["end", "Do"]]) {
    const button = el(`${target}-button`);
    button.textContent = monthLabel(state[target]);
    button.setAttribute("aria-label", `${caption}: ${monthLabel(state[target])}`);
  }

  // The picker can't produce a reversed range, but URL params still can.
  if (start >= end) {
    inputError.textContent = "Počáteční měsíc musí předcházet koncovému.";
    inputError.hidden = false;
    return;
  }
  inputError.hidden = true;

  history.replaceState(null, "", `?start=${start}&end=${end}`);

  const totalPct = InflaceMath.inflationPct(state.total, start, end);
  const annualizedPct = InflaceMath.annualizedPct(state.total, start, end);
  const monthCount = InflaceMath.monthsBetween(start, end);
  const categories = Object.entries(state.categories)
    .filter(([code]) => code !== TOTAL_CODE)
    .map(([code, name]) => ({
      code, name,
      pct: InflaceMath.categoryPct(state.series[code] || {}, start, end),
    }));

  el("hero-value").textContent = signedPct(totalPct);
  el("hero-period").textContent =
    `od ${monthLabelGenitive(start)} do ${monthLabelGenitive(end)}`;
  el("tile-annual").textContent = signedPct(annualizedPct, fmtPct2);
  el("tile-price").textContent =
    `${fmtCzk.format(100 * (1 + totalPct / 100))} Kč`;
  el("tile-length").textContent = periodLengthText(monthCount);
  el("categories-period").textContent =
    `Změna cen od ${monthLabelGenitive(start)} do ${monthLabelGenitive(end)}`;

  renderCategories(categories);
  drawChartEmphasis();
}

function renderCategories(categories) {
  const container = el("categories");
  container.replaceChildren();

  const values = categories.filter((c) => c.pct !== null).map((c) => c.pct);
  const posMax = Math.max(0, ...values);
  const negMax = Math.max(0, ...values.map((v) => -v));
  const span = posMax + negMax || 1;

  // Reserve track space for tip labels: right always, left only with negatives.
  const padRight = 13;
  const padLeft = negMax > 0 ? 13 : 0;
  const dataWidth = 100 - padLeft - padRight;
  const zero = padLeft + (negMax / span) * dataWidth;

  const sorted = [...categories].sort((a, b) =>
    (a.pct === null) - (b.pct === null) || b.pct - a.pct);

  for (const category of sorted) {
    const row = document.createElement("div");
    row.className = "cat-row";

    const name = document.createElement("p");
    name.className = "cat-name";
    name.textContent = category.name;

    const track = document.createElement("div");
    track.className = "cat-track";

    const zeroLine = document.createElement("div");
    zeroLine.className = "cat-zero";
    zeroLine.style.left = `${zero}%`;
    track.append(zeroLine);

    const value = document.createElement("span");
    value.className = "cat-value";

    if (category.pct === null) {
      value.classList.add("missing");
      value.textContent = "data nejsou k dispozici";
      value.style.left = `calc(${zero}% + 8px)`;
    } else {
      const width = (Math.abs(category.pct) / span) * dataWidth;
      const bar = document.createElement("div");
      bar.className = `cat-bar ${category.pct >= 0 ? "positive" : "negative"}`;
      bar.style.width = `${width}%`;
      value.textContent = signedPct(category.pct);
      if (category.pct >= 0) {
        bar.style.left = `${zero}%`;
        value.style.left = `calc(${zero + width}% + 8px)`;
      } else {
        bar.style.left = `${zero - width}%`;
        value.style.right = `calc(${100 - (zero - width)}% + 8px)`;
      }
      track.append(bar);
    }

    track.append(value);
    row.append(name, track);
    container.append(row);
  }
}

/* ---------- chart ---------- */

const chart = {
  svg: null,
  scaleX: null,
  scaleY: null,
  yMin: 0,
  yMax: 0,
  emphasisGroup: null,
  crosshair: null,
  marker: null,
};

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val);
  return node;
}

function drawChartBase() {
  // Size the viewBox to the container so text renders at natural size
  // on any screen width instead of scaling down uniformly.
  const wrapWidth = el("chart-wrap").clientWidth || CHART.w;
  CHART.w = Math.max(320, Math.min(800, Math.round(wrapWidth)));
  CHART.h = Math.round(CHART.w * 0.35) + 42;
  const { w, h, left, right, top, bottom } = CHART;
  const svg = el("chart");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.replaceChildren();
  chart.svg = svg;

  const values = state.months.map((m) => state.total[m]);
  chart.yMin = Math.floor(Math.min(...values) / 10) * 10;
  chart.yMax = Math.ceil(Math.max(...values) / 10) * 10;

  const plotW = w - left - right;
  const plotH = h - top - bottom;
  chart.scaleX = (i) => left + (i / (state.months.length - 1)) * plotW;
  chart.scaleY = (v) => top + (1 - (v - chart.yMin) / (chart.yMax - chart.yMin)) * plotH;

  const css = getComputedStyle(document.documentElement);
  const color = (name) => css.getPropertyValue(name).trim();

  // Horizontal gridlines + y tick labels (clean tens).
  for (let v = chart.yMin; v <= chart.yMax; v += 10) {
    const y = chart.scaleY(v);
    svg.append(svgEl("line", {
      x1: left, x2: w - right, y1: y, y2: y,
      stroke: v === chart.yMin ? color("--baseline") : color("--gridline"),
      "stroke-width": 1,
    }));
    const label = svgEl("text", {
      x: left - 8, y: y + 4, "text-anchor": "end",
      fill: color("--ink-muted"), "font-size": 12,
    });
    label.textContent = String(v);
    svg.append(label);
  }

  // X tick labels: each January; every other year when narrow.
  const yearStep = w < 560 ? 2 : 1;
  state.months.forEach((month, i) => {
    if (!month.endsWith("-01")) return;
    if (Number(month.slice(0, 4)) % yearStep !== 0) return;
    const x = chart.scaleX(i);
    const label = svgEl("text", {
      x, y: h - bottom + 20, "text-anchor": "middle",
      fill: color("--ink-muted"), "font-size": 12,
    });
    label.textContent = month.slice(0, 4);
    svg.append(label);
  });

  // Full series in de-emphasis gray; selected range is drawn over it.
  svg.append(svgEl("path", {
    d: linePath(0, state.months.length - 1),
    fill: "none", stroke: color("--accent-dim"),
    "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round",
  }));

  chart.emphasisGroup = svgEl("g", {});
  svg.append(chart.emphasisGroup);

  chart.crosshair = svgEl("line", {
    y1: top, y2: h - bottom, stroke: color("--baseline"),
    "stroke-width": 1, visibility: "hidden",
  });
  svg.append(chart.crosshair);

  chart.marker = svgEl("circle", {
    r: 4.5, fill: color("--accent"), stroke: color("--surface"),
    "stroke-width": 2, visibility: "hidden",
  });
  svg.append(chart.marker);

  const overlay = svgEl("rect", {
    x: left, y: top, width: plotW, height: plotH, fill: "transparent",
  });
  overlay.addEventListener("pointermove", onChartHover);
  overlay.addEventListener("pointerleave", hideChartTooltip);
  svg.append(overlay);
}

function linePath(fromIdx, toIdx) {
  const parts = [];
  for (let i = fromIdx; i <= toIdx; i++) {
    const x = chart.scaleX(i).toFixed(2);
    const y = chart.scaleY(state.total[state.months[i]]).toFixed(2);
    parts.push(`${i === fromIdx ? "M" : "L"}${x},${y}`);
  }
  return parts.join("");
}

function drawChartEmphasis() {
  const group = chart.emphasisGroup;
  group.replaceChildren();
  const si = state.months.indexOf(state.start);
  const ei = state.months.indexOf(state.end);
  if (si < 0 || ei < 0) return;

  const css = getComputedStyle(document.documentElement);
  const color = (name) => css.getPropertyValue(name).trim();
  const baseY = chart.scaleY(chart.yMin);

  // Area wash under the selected range.
  const area = linePath(si, ei)
    + `L${chart.scaleX(ei).toFixed(2)},${baseY.toFixed(2)}`
    + `L${chart.scaleX(si).toFixed(2)},${baseY.toFixed(2)}Z`;
  group.append(svgEl("path", { d: area, fill: color("--wash"), stroke: "none" }));

  group.append(svgEl("path", {
    d: linePath(si, ei),
    fill: "none", stroke: color("--accent"),
    "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round",
  }));

  for (const i of [si, ei]) {
    group.append(svgEl("circle", {
      cx: chart.scaleX(i), cy: chart.scaleY(state.total[state.months[i]]),
      r: 4.5, fill: color("--accent"),
      stroke: color("--surface"), "stroke-width": 2,
    }));
  }
}

function onChartHover(event) {
  const svg = chart.svg;
  const rect = svg.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / rect.width) * CHART.w;
  const plotW = CHART.w - CHART.left - CHART.right;
  const i = Math.max(0, Math.min(state.months.length - 1,
    Math.round(((px - CHART.left) / plotW) * (state.months.length - 1))));
  const month = state.months[i];
  const value = state.total[month];
  const x = chart.scaleX(i);
  const y = chart.scaleY(value);

  chart.crosshair.setAttribute("x1", x);
  chart.crosshair.setAttribute("x2", x);
  chart.crosshair.setAttribute("visibility", "visible");
  chart.marker.setAttribute("cx", x);
  chart.marker.setAttribute("cy", y);
  chart.marker.setAttribute("visibility", "visible");

  const tooltip = el("chart-tooltip");
  tooltip.replaceChildren();
  const valueLine = document.createElement("div");
  valueLine.className = "tt-value";
  const key = document.createElement("span");
  key.className = "tt-key";
  valueLine.append(key, document.createTextNode(fmtIndex.format(value)));
  const labelLine = document.createElement("div");
  labelLine.className = "tt-label";
  labelLine.textContent = monthLabel(month);
  tooltip.append(valueLine, labelLine);
  tooltip.hidden = false;

  const xPx = (x / CHART.w) * rect.width;
  const yPx = (y / CHART.h) * rect.height;
  const flip = xPx > rect.width * 0.72;
  tooltip.style.left = flip ? `${xPx - tooltip.offsetWidth - 14}px` : `${xPx + 14}px`;
  tooltip.style.top = `${Math.max(0, yPx - tooltip.offsetHeight - 8)}px`;
}

function hideChartTooltip() {
  chart.crosshair.setAttribute("visibility", "hidden");
  chart.marker.setAttribute("visibility", "hidden");
  el("chart-tooltip").hidden = true;
}

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!state.months.length) return;
    drawChartBase();
    drawChartEmphasis();
  }, 150);
});

boot();
