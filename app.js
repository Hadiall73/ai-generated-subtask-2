/* ═══════════════════════════════════════════════════════════════
   PULSE · Dashboard — data, stat tiles, SVG charts
   Charts follow the dataviz spec: single axis, 2px lines, ≤24px
   bars with 4px rounded data-ends, hairline solid grid, crosshair
   tooltips, table view per chart, text in text tokens only.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const SVG_NS = "http://www.w3.org/2000/svg";
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const COLORS = {
    dist: css("--series-1"),   // blue
    hr:   css("--series-6"),   // red
    sys:  css("--series-1"),   // blue
    dia:  css("--series-5"),   // violet
    cal:  css("--series-3"),   // yellow
  };

  /* ─── Settings (localStorage) ─────────────────────────────── */
  const SETTINGS_KEY = "pulse.settings";
  const settings = Object.assign(
    { weightKg: 75, paceMinPerKm: 6 },
    JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
  );
  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  window.PULSE = { settings }; // shared with routes.js

  /* ─── Demo data (seeded, deterministic) ───────────────────── */
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DAYS = 90;
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  function buildHistory() {
    const rnd = mulberry32(20260704);
    const days = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 86400000);
      const dow = date.getDay();
      // rest days: ~2 per week, more likely Mon/Fri
      const restChance = dow === 1 || dow === 5 ? 0.55 : 0.25;
      const rest = rnd() < restChance && i !== 0; // always a run today for a lively demo
      let km = 0, hr = null, kcal = 0;
      if (!rest) {
        const long = dow === 0; // Sunday long run
        km = long ? 9 + rnd() * 6 : 3.5 + rnd() * 4.5;
        km = Math.round(km * 10) / 10;
        hr = Math.round(138 + rnd() * 24 + (long ? 6 : 0));
        kcal = Math.round(km * settings.weightKg * 1.036);
      }
      days.push({ date, km, hr, kcal });
    }
    return days;
  }

  const BP_KEY = "pulse.bp";
  function buildBPSeed() {
    const rnd = mulberry32(42);
    const entries = [];
    for (let i = DAYS - 1; i >= 0; i -= 3) {
      const date = new Date(today.getTime() - i * 86400000);
      entries.push({
        t: date.getTime(),
        sys: Math.round(116 + rnd() * 14),
        dia: Math.round(74 + rnd() * 10),
      });
    }
    return entries;
  }
  function loadBP() {
    const user = JSON.parse(localStorage.getItem(BP_KEY) || "[]");
    return buildBPSeed().concat(user).sort((a, b) => a.t - b.t);
  }
  function saveBPEntry(sys, dia) {
    const user = JSON.parse(localStorage.getItem(BP_KEY) || "[]");
    user.push({ t: Date.now(), sys, dia });
    localStorage.setItem(BP_KEY, JSON.stringify(user));
  }

  let history = buildHistory();
  let bpData = loadBP();
  let range = 7;

  /* ─── Formatting helpers ──────────────────────────────────── */
  const fmtDay = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });
  const fmtDayLong = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  const fmtNum = new Intl.NumberFormat("de-DE");
  const fmtKm = (v) => fmtNum.format(Math.round(v * 10) / 10);

  /* ─── Tooltip singleton (textContent only — untrusted-safe) ─ */
  const tooltip = $("#tooltip");
  function showTooltip(x, y, title, rows) {
    tooltip.textContent = "";
    const t = document.createElement("div");
    t.className = "tt-title";
    t.textContent = title;
    tooltip.appendChild(t);
    for (const r of rows) {
      const row = document.createElement("div");
      row.className = "tt-row";
      if (r.color) {
        const key = document.createElement("span");
        key.className = "tt-key";
        key.style.background = r.color;
        row.appendChild(key);
      }
      const val = document.createElement("span");
      val.className = "tt-value";
      val.textContent = r.value;
      row.appendChild(val);
      const lbl = document.createElement("span");
      lbl.textContent = r.label;
      row.appendChild(lbl);
      tooltip.appendChild(row);
    }
    tooltip.hidden = false;
    const pad = 14;
    const rect = tooltip.getBoundingClientRect();
    let left = x + pad;
    if (left + rect.width > window.innerWidth - 8) left = x - rect.width - pad;
    let top = y - rect.height - pad;
    if (top < 8) top = y + pad;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }
  function hideTooltip() { tooltip.hidden = true; }

  /* ─── SVG helpers ─────────────────────────────────────────── */
  function el(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }
  function niceTicks(max, count = 4) {
    const raw = max / count;
    const mag = 10 ** Math.floor(Math.log10(raw || 1));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10;
    const ticks = [];
    for (let v = 0; v < max; v += step) ticks.push(Math.round(v * 100) / 100);
    ticks.push(Math.round((ticks.length * step) * 100) / 100); // top tick always covers the max
    return ticks;
  }

  const BASE = { h: 240, top: 14, right: 16, bottom: 30, left: 44 };

  function chartFrame(container, yTicks, yMax, yMin = 0, width = 560) {
    container.textContent = "";
    const dims = { ...BASE, w: width };
    const svg = el("svg", {
      viewBox: `0 0 ${dims.w} ${dims.h}`,
      role: "img",
    });
    const plotW = dims.w - dims.left - dims.right;
    const plotH = dims.h - dims.top - dims.bottom;
    const yPos = (v) => dims.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

    // hairline solid gridlines + y tick labels
    for (const t of yTicks) {
      const y = yPos(t);
      svg.appendChild(el("line", {
        x1: dims.left, x2: dims.w - dims.right, y1: y, y2: y,
        stroke: t === yMin ? css("--baseline") : css("--grid"),
        "stroke-width": 1,
      }));
      const label = el("text", { x: dims.left - 8, y: y + 3.5, "text-anchor": "end", class: "axis-text" });
      label.textContent = fmtNum.format(t);
      svg.appendChild(label);
    }
    container.appendChild(svg);
    return { svg, plotW, plotH, yPos, dims };
  }

  function xLabels(svg, positions, labels, dims) {
    // thin out labels so they never collide
    const maxLabels = Math.max(6, Math.floor(dims.w / 56));
    const step = Math.ceil(labels.length / maxLabels);
    const last = labels.length - 1;
    labels.forEach((text, i) => {
      const regular = i % step === 0;
      // force the last label only when it doesn't crowd the previous regular one
      const forcedLast = i === last && last % step >= Math.ceil(step / 2);
      if (!regular && !forcedLast) return;
      if (regular && i !== last && last - i < step && last % step >= Math.ceil(step / 2)) return;
      const t = el("text", {
        x: positions[i], y: dims.h - 10, "text-anchor": "middle", class: "axis-text",
      });
      t.textContent = text;
      svg.appendChild(t);
    });
  }

  /* ─── Bar chart: Distanz pro Tag ──────────────────────────── */
  function renderDistChart(data) {
    const container = $("#chart-dist");
    const max = Math.max(1, ...data.map((d) => d.km));
    const ticks = niceTicks(max);
    const { svg, plotW, yPos, dims } = chartFrame(container, ticks, ticks[ticks.length - 1]);
    const n = data.length;
    const band = plotW / n;
    const barW = Math.min(24, Math.max(3, band - 2)); // ≤24px, ≥2px surface gap
    const baseY = yPos(0);
    const maxIdx = data.reduce((best, d, i) => (d.km > data[best].km ? i : best), 0);
    const positions = [];

    data.forEach((d, i) => {
      const cx = dims.left + band * i + band / 2;
      positions.push(cx);
      const y = yPos(d.km);
      const h = Math.max(0, baseY - y);
      if (h > 0) {
        const r = Math.min(4, barW / 2, h); // 4px rounded data-end, square baseline
        svg.appendChild(el("path", {
          d: `M ${cx - barW / 2} ${baseY}
              V ${y + r}
              Q ${cx - barW / 2} ${y} ${cx - barW / 2 + r} ${y}
              H ${cx + barW / 2 - r}
              Q ${cx + barW / 2} ${y} ${cx + barW / 2} ${y + r}
              V ${baseY} Z`,
          fill: COLORS.dist,
          "data-i": i,
        }));
      }
      // selective direct label: only the extreme
      if (i === maxIdx && d.km > 0) {
        const lbl = el("text", { x: cx, y: y - 6, "text-anchor": "middle", class: "mark-label" });
        lbl.textContent = fmtKm(d.km);
        svg.appendChild(lbl);
      }
      // generous invisible hit target (≥ band width)
      const hit = el("rect", {
        x: dims.left + band * i, y: dims.top,
        width: band, height: dims.h - dims.top - dims.bottom,
        fill: "transparent", tabindex: "0",
      });
      const show = (e) => {
        const p = e.touches ? e.touches[0] : e;
        const pt = p.clientX !== undefined ? p : hit.getBoundingClientRect();
        showTooltip(
          pt.clientX ?? pt.left, pt.clientY ?? pt.top,
          fmtDayLong.format(d.date),
          d.km > 0
            ? [{ color: COLORS.dist, value: `${fmtKm(d.km)} km`, label: "Distanz" },
               { color: COLORS.cal, value: `${fmtNum.format(d.kcal)} kcal`, label: "Kalorien" }]
            : [{ value: "Ruhetag", label: "" }]
        );
        svg.querySelectorAll("path[data-i]").forEach((b) => (b.style.opacity = b.dataset.i == i ? "1" : "0.45"));
      };
      const hide = () => {
        hideTooltip();
        svg.querySelectorAll("path[data-i]").forEach((b) => (b.style.opacity = "1"));
      };
      hit.addEventListener("pointermove", show);
      hit.addEventListener("pointerleave", hide);
      hit.addEventListener("focus", show);
      hit.addEventListener("blur", hide);
      svg.appendChild(hit);
    });

    xLabels(svg, positions, data.map((d) => fmtDay.format(d.date)), dims);
    renderTable("#table-dist", ["Datum", "Distanz (km)", "Kalorien (kcal)"],
      data.map((d) => [fmtDayLong.format(d.date), d.km > 0 ? fmtKm(d.km) : "–", d.km > 0 ? fmtNum.format(d.kcal) : "–"]));
  }

  /* ─── Line charts (shared engine, crosshair tooltip) ──────── */
  function renderLineChart(containerSel, series, xLabelFn, opts = {}) {
    const container = $(containerSel);
    const points = series[0].data; // aligned x across series
    const allVals = series.flatMap((s) => s.data.map((p) => p.v)).filter((v) => v != null);
    if (allVals.length === 0) { container.textContent = "Keine Daten"; return; }
    const rawMin = Math.min(...allVals), rawMax = Math.max(...allVals);
    const pad = Math.max(2, (rawMax - rawMin) * 0.25);
    const yMin = opts.zero ? 0 : Math.max(0, Math.floor((rawMin - pad) / 10) * 10);
    const yMax = Math.ceil((rawMax + pad) / 10) * 10;
    const ticks = [];
    const step = Math.max(10, Math.round((yMax - yMin) / 4 / 10) * 10);
    for (let v = yMin; v <= yMax; v += step) ticks.push(v);
    const { svg, plotW, yPos, dims } = chartFrame(container, ticks, ticks[ticks.length - 1], yMin, opts.width);

    const n = points.length;
    const xPos = (i) => dims.left + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
    const positions = points.map((_, i) => xPos(i));

    for (const s of series) {
      const pts = s.data
        .map((p, i) => (p.v == null ? null : `${xPos(i)},${yPos(p.v)}`))
        .filter(Boolean);
      if (opts.area && pts.length > 1) {
        const first = pts[0].split(",")[0], last = pts[pts.length - 1].split(",")[0];
        svg.appendChild(el("polygon", {
          points: `${first},${yPos(yMin)} ${pts.join(" ")} ${last},${yPos(yMin)}`,
          fill: s.color, opacity: 0.1,
        }));
      }
      svg.appendChild(el("polyline", {
        points: pts.join(" "),
        fill: "none", stroke: s.color, "stroke-width": 2,
        "stroke-linecap": "round", "stroke-linejoin": "round",
      }));
      // end marker: ≥8px dot with 2px surface ring
      const lastIdx = s.data.length - 1;
      if (s.data[lastIdx].v != null) {
        svg.appendChild(el("circle", {
          cx: xPos(lastIdx), cy: yPos(s.data[lastIdx].v), r: 4,
          fill: s.color, stroke: css("--surface-1"), "stroke-width": 2,
        }));
        // direct end label (selective)
        const lbl = el("text", {
          x: Math.min(xPos(lastIdx) - 6, dims.w - dims.right - 4), y: yPos(s.data[lastIdx].v) - 9,
          "text-anchor": "end", class: "mark-label",
        });
        lbl.textContent = fmtNum.format(s.data[lastIdx].v);
        svg.appendChild(lbl);
      }
    }

    xLabels(svg, positions, points.map((p, i) => xLabelFn(p, i)), dims);

    // crosshair + one tooltip listing every series at that X
    const crosshair = el("line", {
      y1: dims.top, y2: dims.h - dims.bottom,
      stroke: css("--baseline"), "stroke-width": 1, visibility: "hidden",
    });
    svg.appendChild(crosshair);
    const overlay = el("rect", {
      x: dims.left, y: dims.top,
      width: plotW, height: dims.h - dims.top - dims.bottom,
      fill: "transparent",
    });
    overlay.addEventListener("pointermove", (e) => {
      const rect = svg.getBoundingClientRect();
      const scale = dims.w / rect.width;
      const mx = (e.clientX - rect.left) * scale;
      let idx = 0, best = Infinity;
      positions.forEach((px, i) => {
        const d = Math.abs(px - mx);
        if (d < best) { best = d; idx = i; }
      });
      crosshair.setAttribute("x1", positions[idx]);
      crosshair.setAttribute("x2", positions[idx]);
      crosshair.setAttribute("visibility", "visible");
      const rows = series
        .filter((s) => s.data[idx].v != null)
        .map((s) => ({ color: s.color, value: `${fmtNum.format(s.data[idx].v)} ${opts.unit || ""}`.trim(), label: s.name }));
      showTooltip(e.clientX, e.clientY, xLabelFn(points[idx], idx),
        rows.length ? rows : [{ value: "Keine Daten", label: "" }]);
    });
    overlay.addEventListener("pointerleave", () => {
      crosshair.setAttribute("visibility", "hidden");
      hideTooltip();
    });
    svg.appendChild(overlay);
  }

  /* ─── Table views (WCAG twin for every chart) ─────────────── */
  function renderTable(sel, headers, rows) {
    const wrap = $(sel);
    wrap.textContent = "";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    headers.forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      r.forEach((c) => {
        const td = document.createElement("td");
        td.textContent = c;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  document.querySelectorAll(".table-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.chart;
      const chart = $(`#chart-${key}`);
      const table = $(`#table-${key}`);
      const showTable = table.hidden;
      table.hidden = !showTable;
      chart.style.display = showTable ? "none" : "";
      btn.setAttribute("aria-pressed", String(showTable));
      btn.textContent = showTable ? "Diagramm" : "Tabelle";
    });
  });

  /* ─── Stat tiles ──────────────────────────────────────────── */
  function sparkline(svgSel, values, color) {
    const svg = $(svgSel);
    svg.textContent = "";
    const w = 120, h = 32, max = Math.max(1, ...values);
    const pts = values.map((v, i) =>
      `${(i / (values.length - 1)) * w},${h - 3 - (v / max) * (h - 6)}`);
    svg.appendChild(el("polyline", {
      points: pts.join(" "), fill: "none",
      stroke: color, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round",
      opacity: 0.85,
    }));
  }

  function bpStatus(sys, dia) {
    if (sys >= 140 || dia >= 90) return { text: "⚠ Erhöht – ärztlich abklären", cls: "down" };
    if (sys >= 130 || dia >= 85) return { text: "◐ Leicht erhöht", cls: "down" };
    return { text: "✓ Im Normalbereich", cls: "up" };
  }

  function renderTiles() {
    const todayEntry = history[history.length - 1];
    const yesterday = history[history.length - 2];

    // calories today
    $("#tile-cal-value").innerHTML = "";
    $("#tile-cal-value").append(fmtNum.format(todayEntry.kcal), Object.assign(document.createElement("small"), { textContent: "kcal" }));
    const dCal = todayEntry.kcal - yesterday.kcal;
    setDelta("#tile-cal-delta", dCal, "kcal", "gestern", true);
    sparkline("#tile-cal-spark", history.slice(-14).map((d) => d.kcal), COLORS.cal);

    // week distance vs previous week
    const week = history.slice(-7).reduce((s, d) => s + d.km, 0);
    const prevWeek = history.slice(-14, -7).reduce((s, d) => s + d.km, 0);
    $("#tile-dist-value").innerHTML = "";
    $("#tile-dist-value").append(fmtKm(week), Object.assign(document.createElement("small"), { textContent: "km" }));
    setDelta("#tile-dist-delta", week - prevWeek, "km", "Vorwoche", true, fmtKm);
    sparkline("#tile-dist-spark", history.slice(-14).map((d) => d.km), COLORS.dist);

    // avg HR of last run
    const lastRun = [...history].reverse().find((d) => d.hr != null);
    $("#tile-hr-value").innerHTML = "";
    $("#tile-hr-value").append(String(lastRun ? lastRun.hr : "–"), Object.assign(document.createElement("small"), { textContent: "bpm" }));
    $("#tile-hr-delta").textContent = lastRun ? fmtDayLong.format(lastRun.date) : "";

    // latest BP
    const lastBP = bpData[bpData.length - 1];
    $("#tile-bp-value").innerHTML = "";
    $("#tile-bp-value").append(`${lastBP.sys}/${lastBP.dia}`, Object.assign(document.createElement("small"), { textContent: "mmHg" }));
    const st = bpStatus(lastBP.sys, lastBP.dia);
    const el2 = $("#tile-bp-status");
    el2.textContent = "";
    const span = document.createElement("span");
    span.className = st.cls;
    span.textContent = st.text;
    el2.appendChild(span);
  }

  function setDelta(sel, delta, unit, vs, upIsGood, fmt = (v) => fmtNum.format(Math.round(v))) {
    const node = $(sel);
    node.textContent = "";
    const span = document.createElement("span");
    const up = delta >= 0;
    span.className = up === upIsGood ? "up" : "down";
    span.textContent = `${up ? "▲" : "▼"} ${fmt(Math.abs(delta))} ${unit}`;
    node.appendChild(span);
    node.append(` vs. ${vs}`);
  }

  /* ─── Render everything for the current range ─────────────── */
  function renderCharts() {
    const slice = history.slice(-range);
    renderDistChart(slice);

    const runs = slice.filter((d) => d.hr != null);
    renderLineChart("#chart-hr",
      [{ name: "Ø Puls", color: COLORS.hr, data: runs.map((d) => ({ x: d.date, v: d.hr })) }],
      (p) => fmtDay.format(p.x), { unit: "bpm", area: true });
    renderTable("#table-hr", ["Datum", "Ø Puls (bpm)"],
      runs.map((d) => [fmtDayLong.format(d.date), String(d.hr)]));

    const cutoff = today.getTime() - range * 86400000;
    const bp = bpData.filter((e) => e.t >= cutoff);
    const bpPoints = bp.map((e) => ({ x: new Date(e.t) }));
    renderLineChart("#chart-bp", [
      { name: "Systolisch", color: COLORS.sys, data: bp.map((e, i) => ({ x: bpPoints[i].x, v: e.sys })) },
      { name: "Diastolisch", color: COLORS.dia, data: bp.map((e, i) => ({ x: bpPoints[i].x, v: e.dia })) },
    ], (p) => fmtDay.format(p.x), { unit: "mmHg", width: 1120 });
    renderTable("#table-bp", ["Datum", "Systolisch (mmHg)", "Diastolisch (mmHg)"],
      bp.map((e) => [fmtDayLong.format(new Date(e.t)), String(e.sys), String(e.dia)]));
  }

  /* ─── Filter row ──────────────────────────────────────────── */
  document.querySelectorAll(".chip[data-range]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-range]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      range = Number(chip.dataset.range);
      renderCharts();
    });
  });

  /* ─── BP form ─────────────────────────────────────────────── */
  $("#bp-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const sys = Number($("#bp-sys").value);
    const dia = Number($("#bp-dia").value);
    if (!sys || !dia) return;
    saveBPEntry(sys, dia);
    bpData = loadBP();
    $("#bp-sys").value = "";
    $("#bp-dia").value = "";
    renderTiles();
    renderCharts();
  });

  /* ─── Settings dialog ─────────────────────────────────────── */
  const dialog = $("#settings-dialog");
  $("#btn-settings").addEventListener("click", () => {
    $("#set-weight").value = settings.weightKg;
    $("#set-pace").value = settings.paceMinPerKm;
    dialog.showModal();
  });
  $("#settings-form").addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value === "save") {
      settings.weightKg = Number($("#set-weight").value) || settings.weightKg;
      settings.paceMinPerKm = Number($("#set-pace").value) || settings.paceMinPerKm;
      saveSettings();
      history = buildHistory(); // recompute calories with new weight
      renderTiles();
      renderCharts();
      document.dispatchEvent(new CustomEvent("pulse:settings-changed"));
    }
  });

  /* ─── Header ──────────────────────────────────────────────── */
  const hour = new Date().getHours();
  $("#greeting-text").textContent =
    hour < 11 ? "Guten Morgen, Läufer:in" : hour < 18 ? "Guten Tag, Läufer:in" : "Guten Abend, Läufer:in";
  $("#greeting-date").textContent = new Intl.DateTimeFormat("de-DE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date());

  /* ─── Distance slider fill + hero number ──────────────────── */
  const slider = $("#distance-slider");
  function syncSlider() {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty("--fill", `${pct}%`);
    $("#hero-distance").textContent = fmtNum.format(Number(slider.value));
  }
  slider.addEventListener("input", syncSlider);
  syncSlider();

  renderTiles();
  renderCharts();
})();
