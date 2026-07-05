/* ═══════════════════════════════════════════════════════════════
   PULSE · Route planner — Leaflet map + OSRM loop generation
   Builds round-trip running loops for a target distance:
   - pedestrian routing (FOSSGIS OSRM foot profile) so loops follow
     paths and parks instead of car roads
   - 8 waypoints sampled on a circle around the start
   - 6 candidate loops (one per compass direction), scored by
     self-overlap (no out-and-back!) and distance match; best 3 shown
   ═══════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const fmtNum = new Intl.NumberFormat("de-DE");
  const fmtKm = (v) => fmtNum.format(Math.round(v * 10) / 10);

  // Graceful degradation: without Leaflet (offline / CDN blocked) the
  // dashboard keeps working, only the map panel shows a notice.
  if (typeof L === "undefined") {
    const mapEl = document.getElementById("map");
    mapEl.style.display = "grid";
    mapEl.style.placeItems = "center";
    const msg = document.createElement("p");
    msg.className = "muted";
    msg.style.cssText = "max-width:260px;text-align:center;font-size:13.5px;line-height:1.6;padding:20px;";
    msg.textContent = "Karte konnte nicht geladen werden (keine Internetverbindung?). Kalorien, Puls und Blutdruck funktionieren weiterhin.";
    mapEl.appendChild(msg);
    $("#btn-find-route").disabled = true;
    $("#btn-locate").disabled = true;
    $("#route-status").textContent = "Routenplaner benötigt eine Internetverbindung.";
    return;
  }

  const DEFAULT_START = { lat: 52.5145, lng: 13.3501 }; // Berlin, Tiergarten
  let start = { ...DEFAULT_START };
  let routes = [];        // [{ name, latlngs, km, overlap, approx }]
  let selectedIdx = -1;
  let routeLayers = [];

  /* ─── Map setup (dark basemap) ────────────────────────────── */
  const map = L.map("map", { zoomControl: true }).setView([start.lat, start.lng], 14);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  const startIcon = L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:#3987e5;border:3px solid #fff;
      box-shadow:0 0 0 6px rgba(57,135,229,.35),0 4px 14px rgba(0,0,0,.6);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
  const startMarker = L.marker([start.lat, start.lng], { icon: startIcon, draggable: true }).addTo(map);

  function setStart(lat, lng, label) {
    start = { lat, lng };
    startMarker.setLatLng([lat, lng]);
    $("#route-status").textContent =
      label || `Startpunkt: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  map.on("click", (e) => setStart(e.latlng.lat, e.latlng.lng));
  startMarker.on("dragend", () => {
    const p = startMarker.getLatLng();
    setStart(p.lat, p.lng);
  });

  $("#btn-locate").addEventListener("click", () => {
    if (!navigator.geolocation) {
      $("#route-status").textContent = "GPS wird von diesem Browser nicht unterstützt.";
      return;
    }
    $("#route-status").textContent = "Suche deinen Standort …";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart(pos.coords.latitude, pos.coords.longitude, "Startpunkt: dein Standort 📍");
        map.setView([pos.coords.latitude, pos.coords.longitude], 15);
      },
      () => { $("#route-status").textContent = "Standort nicht verfügbar – tippe stattdessen auf die Karte."; },
      { timeout: 8000 }
    );
  });

  /* ─── Geometry helpers ────────────────────────────────────── */
  function offset(origin, distKm, bearingDeg) {
    const rad = (bearingDeg * Math.PI) / 180;
    const dLat = (distKm * Math.cos(rad)) / 110.574;
    const dLng = (distKm * Math.sin(rad)) / (111.32 * Math.cos((origin.lat * Math.PI) / 180));
    return { lat: origin.lat + dLat, lng: origin.lng + dLng };
  }

  function haversineKm(a, b) {
    const R = 6371, toRad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * toRad;
    const dLng = (b[1] - a[1]) * toRad;
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // waypoints on a circle of radius r whose circumference passes through start
  function loopWaypoints(origin, radiusKm, bearingDeg, samples = 8) {
    const center = offset(origin, radiusKm, bearingDeg);
    const startAngle = bearingDeg + 180; // angle from center back to start
    const pts = [origin];
    for (let k = 1; k < samples; k++) {
      pts.push(offset(center, radiusKm, startAngle + (360 / samples) * k));
    }
    pts.push(origin);
    return pts;
  }

  // fraction of the route that runs over the same street segment twice
  // (out-and-back detector); segments snapped to an ~11 m grid
  function overlapFraction(latlngs) {
    const seen = new Set();
    let dup = 0, total = 0;
    const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
    for (let i = 1; i < latlngs.length; i++) {
      const a = latlngs[i - 1], b = latlngs[i];
      const len = haversineKm(a, b);
      if (len === 0) continue;
      total += len;
      const ka = key(a), kb = key(b);
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (seen.has(k)) dup += len;
      else seen.add(k);
    }
    return total ? dup / total : 0;
  }

  /* ─── OSRM routing ────────────────────────────────────────── */
  // Pedestrian graph first (follows footpaths and parks, no one-way
  // detours); the generic demo server only as a last resort.
  const ROUTERS = [
    "https://routing.openstreetmap.de/routed-foot/route/v1/foot/",
    "https://router.project-osrm.org/route/v1/foot/",
  ];
  let activeRouter = 0; // stick with the first router that answers

  async function osrmRoute(waypoints) {
    const coords = waypoints.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
    for (let r = activeRouter; r < ROUTERS.length; r++) {
      const url = `${ROUTERS[r]}${coords}` +
                  `?overview=full&geometries=geojson&continue_straight=true&alternatives=false&steps=false`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) continue;
        const json = await res.json();
        if (json.code !== "Ok" || !json.routes || !json.routes.length) continue;
        activeRouter = r;
        const route = json.routes[0];
        return {
          latlngs: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          km: route.distance / 1000,
        };
      } catch {
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  }

  async function buildLoop(targetKm, bearingDeg) {
    let radius = targetKm / (2 * Math.PI);
    let result = await osrmRoute(loopWaypoints(start, radius, bearingDeg));
    if (result) {
      // one correction pass if the snapped route misses the target badly
      if (Math.abs(result.km - targetKm) / targetKm > 0.12 && result.km > 0.2) {
        const corrected = await osrmRoute(
          loopWaypoints(start, radius * (targetKm / result.km), bearingDeg));
        if (corrected && Math.abs(corrected.km - targetKm) < Math.abs(result.km - targetKm)) {
          result = corrected;
        }
      }
      return { ...result, overlap: overlapFraction(result.latlngs), approx: false, bearing: bearingDeg };
    }
    return null;
  }

  function sketchLoop(targetKm, bearingDeg) {
    const radius = targetKm / (2 * Math.PI);
    const pts = [];
    const center = offset(start, radius, bearingDeg);
    for (let a = 0; a <= 360; a += 10) {
      const p = offset(center, radius, bearingDeg + 180 + a);
      pts.push([p.lat, p.lng]);
    }
    return { latlngs: pts, km: targetKm, overlap: 0, approx: true, bearing: bearingDeg };
  }

  /* ─── Drawing & selection ─────────────────────────────────── */
  function clearRouteLayers() {
    routeLayers.forEach((l) => map.removeLayer(l));
    routeLayers = [];
  }

  function drawRoutes() {
    clearRouteLayers();
    routes.forEach((r, i) => {
      const selected = i === selectedIdx;
      if (selected) {
        routeLayers.push(L.polyline(r.latlngs, {
          color: "#0b0d12", weight: 9, opacity: 0.7, lineJoin: "round",
        }).addTo(map));
      }
      const line = L.polyline(r.latlngs, {
        color: selected ? "#3987e5" : "#566074",
        weight: selected ? 5 : 3,
        opacity: selected ? 1 : 0.55,
        dashArray: r.approx ? "6 8" : null, // sketch only when routing was unavailable
        lineJoin: "round",
      }).addTo(map);
      line.on("click", () => selectRoute(i));
      routeLayers.push(line);
    });
    if (routes[selectedIdx]) {
      map.fitBounds(L.latLngBounds(routes[selectedIdx].latlngs).pad(0.15));
    }
  }

  function selectRoute(i) {
    selectedIdx = i;
    drawRoutes();
    document.querySelectorAll(".route-option").forEach((btn, k) => {
      btn.classList.toggle("selected", k === i);
      btn.setAttribute("aria-selected", String(k === i));
    });
    updateEstimates();
  }

  function updateEstimates() {
    const r = routes[selectedIdx];
    if (!r) return;
    const s = window.PULSE.settings;
    const minutes = r.km * s.paceMinPerKm;
    const kcal = Math.round(r.km * s.weightKg * 1.036);
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    $("#est-dist").textContent = `${fmtKm(r.km)} km${r.approx ? " (geschätzt)" : ""}`;
    $("#est-time").textContent = h > 0 ? `${h} h ${m} min` : `${m} min`;
    $("#est-cal").textContent = `${fmtNum.format(kcal)} kcal`;
    $("#route-estimates").hidden = false;
  }

  function overlapLabel(overlap) {
    if (overlap < 0.1) return "echte Runde";
    if (overlap < 0.25) return "fast ohne Doppelstrecke";
    return `${Math.round(overlap * 100)} % doppelte Wege`;
  }

  function renderOptions() {
    const wrap = $("#route-options");
    wrap.textContent = "";
    routes.forEach((r, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "route-option";
      btn.setAttribute("role", "option");
      const left = document.createElement("span");
      left.className = "ro-name";
      left.textContent = (i === 0 ? "⭐ " : "") + r.name;
      const right = document.createElement("span");
      right.className = "ro-meta";
      right.textContent = r.approx
        ? `${fmtKm(r.km)} km · Skizze`
        : `${fmtKm(r.km)} km · ${overlapLabel(r.overlap)}`;
      btn.append(left, right);
      btn.addEventListener("click", () => selectRoute(i));
      wrap.appendChild(btn);
    });
  }

  /* ─── Find-route action ───────────────────────────────────── */
  const BEARINGS = [0, 60, 120, 180, 240, 300];
  const COMPASS = ["Norden", "Nordosten", "Südosten", "Süden", "Südwesten", "Nordwesten"];

  // quality score: penalize running the same street twice much harder
  // than a small distance mismatch
  function score(r, targetKm) {
    return r.overlap * 3 + Math.abs(r.km - targetKm) / targetKm;
  }

  $("#btn-find-route").addEventListener("click", async () => {
    const targetKm = Number($("#distance-slider").value);
    const btn = $("#btn-find-route");
    btn.disabled = true;
    $("#route-status").textContent = `Prüfe ${BEARINGS.length} Runden-Kandidaten für ${fmtKm(targetKm)} km …`;

    try {
      const results = await Promise.all(BEARINGS.map((b) => buildLoop(targetKm, b)));
      let candidates = results
        .map((r, i) => (r ? { ...r, name: `Runde Richtung ${COMPASS[i]}` } : null))
        .filter(Boolean)
        // drop degenerate loops (way too short = waypoints collapsed onto one road)
        .filter((r) => r.km > targetKm * 0.5);

      if (candidates.length === 0) {
        // routing unreachable → geometric sketches as orientation
        routes = BEARINGS.slice(0, 3).map((b, i) =>
          ({ ...sketchLoop(targetKm, b), name: `Runde Richtung ${COMPASS[i]}` }));
        renderOptions();
        selectRoute(0);
        $("#route-status").textContent =
          "Routing-Dienst nicht erreichbar – Skizzen als Orientierung (gestrichelt).";
        return;
      }

      candidates.sort((a, b) => score(a, targetKm) - score(b, targetKm));
      routes = candidates.slice(0, 3);
      renderOptions();
      selectRoute(0);

      const best = routes[0];
      $("#route-status").textContent = best.overlap < 0.25
        ? `Beste Runde: ${fmtKm(best.km)} km, ${overlapLabel(best.overlap)} – sortiert nach Runden-Qualität.`
        : `In dieser Gegend ist das Wegenetz dünn – beste gefundene Runde: ${fmtKm(best.km)} km (${overlapLabel(best.overlap)}). Verschiebe den Start etwas und versuch es erneut.`;
    } catch {
      $("#route-status").textContent = "Routensuche fehlgeschlagen – bitte erneut versuchen.";
    } finally {
      btn.disabled = false;
    }
  });

  // estimates depend on weight/pace → refresh when profile changes
  document.addEventListener("pulse:settings-changed", updateEstimates);
})();
