/* Otable application logic */
(function () {
  "use strict";

  const {
    CITIES, getRestaurants, seatingAt, nearestCity, distanceKm,
    timeToMin, minToTime, DINNER_START_MIN, DINNER_END_MIN, SLOT_STEP,
  } = window.OtableData;

  const form = document.getElementById("search-form");
  const results = document.getElementById("results");
  const cityInput = document.getElementById("area-city");
  const radiusInput = document.getElementById("area-radius");
  const partyInput = document.getElementById("party");
  const dateInput = document.getElementById("dine-date");
  const exactTimeInput = document.getElementById("exact-time");
  const startTimeInput = document.getElementById("start-time");
  const endTimeInput = document.getElementById("end-time");
  const selectedAreaEl = document.getElementById("selected-area");

  /* The chosen search area: { lat, lng, label, isCustom }. Set by picking a
   * city (from the box) or by clicking / dragging on the map. */
  let area = null;
  let timeMode = "exact";

  /* ---------------------------------------------------------------- */
  /* Autocomplete widget (city box)                                   */
  /* ---------------------------------------------------------------- */
  function attachAutocomplete(wrapper, getMatches) {
    const input = wrapper.querySelector("input");
    const list = wrapper.querySelector(".suggestions");
    let activeIndex = -1;
    let items = [];

    function close() {
      list.hidden = true;
      list.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      activeIndex = -1;
    }
    function render(matches) {
      items = matches;
      if (!matches.length) { close(); return; }
      list.innerHTML = matches
        .map((m, i) =>
          `<li role="option" data-i="${i}">${escapeHtml(m.label)}` +
          (m.hint ? `<small>${escapeHtml(m.hint)}</small>` : "") + `</li>`)
        .join("");
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      activeIndex = -1;
    }
    function choose(i) {
      const m = items[i];
      if (!m) return;
      input.value = m.value;
      close();
      input.dispatchEvent(new CustomEvent("ac:select", { detail: m }));
    }
    input.addEventListener("input", () => render(getMatches(input.value)));
    input.addEventListener("focus", () => {
      const matches = getMatches(input.value);
      if (matches.length) render(matches);
    });
    input.addEventListener("keydown", (e) => {
      if (list.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        activeIndex = (activeIndex + dir + items.length) % items.length;
        [...list.children].forEach((li, i) => li.classList.toggle("is-active", i === activeIndex));
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        choose(activeIndex);
      } else if (e.key === "Escape") {
        close();
      }
    });
    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li");
      if (li) { e.preventDefault(); choose(Number(li.dataset.i)); }
    });
    document.addEventListener("click", (e) => { if (!wrapper.contains(e.target)) close(); });
  }

  function matchCities(query) {
    const q = query.trim().toLowerCase();
    return CITIES
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((c) => ({ label: c.name, hint: c.country, value: c.name }));
  }

  function getCity(name) {
    return CITIES.find((c) => c.name.toLowerCase() === (name || "").trim().toLowerCase()) || null;
  }

  attachAutocomplete(form.querySelector('[data-field="city"]'), matchCities);

  // Choosing a city sets the search area and recentres the map.
  cityInput.addEventListener("ac:select", (e) => {
    const c = getCity(e.detail.value);
    if (c) setArea({ lat: c.lat, lng: c.lng, label: c.name, isCustom: false });
  });

  /* ---------------------------------------------------------------- */
  /* Time mode toggle (exact time / range)                            */
  /* ---------------------------------------------------------------- */
  const timeButtons = form.querySelectorAll(".time-btn");
  const timeFieldGroups = form.querySelectorAll(".time-fields");
  timeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      timeMode = btn.dataset.timeMode;
      timeButtons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
      });
      timeFieldGroups.forEach((g) => { g.hidden = g.dataset.time !== timeMode; });
    });
  });

  /* ---------------------------------------------------------------- */
  /* Map picker (Leaflet) — click / drag to choose a geographic point */
  /* ---------------------------------------------------------------- */
  let pickerMap = null, areaMarker = null, areaCircle = null;

  function initPicker() {
    const el = document.getElementById("picker-map");
    if (typeof L === "undefined") {
      el.classList.add("map-fallback");
      el.textContent = "The map needs an internet connection to load — you can still search by typing a city above.";
      return;
    }
    const start = CITIES[0]; // Paris
    pickerMap = L.map(el, { scrollWheelZoom: false }).setView([start.lat, start.lng], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
    }).addTo(pickerMap);

    pickerMap.on("click", (e) => {
      cityInput.value = "";
      const near = nearestCity({ lat: e.latlng.lat, lng: e.latlng.lng });
      const label = near.distance <= 25
        ? `Custom point near ${near.city.name}`
        : "Custom map point";
      setArea({ lat: e.latlng.lat, lng: e.latlng.lng, label, isCustom: true }, { keepView: true });
    });
  }

  /* Set the active search area and reflect it on the map + label. */
  function setArea(next, opts) {
    opts = opts || {};
    area = next;
    selectedAreaEl.innerHTML = `📍 Searching around <b>${escapeHtml(next.label)}</b>`;

    if (!pickerMap) return;
    const latlng = [next.lat, next.lng];

    if (!areaMarker) {
      areaMarker = L.marker(latlng, { draggable: true }).addTo(pickerMap);
      areaMarker.on("dragend", () => {
        const p = areaMarker.getLatLng();
        cityInput.value = "";
        const near = nearestCity({ lat: p.lat, lng: p.lng });
        const label = near.distance <= 25 ? `Custom point near ${near.city.name}` : "Custom map point";
        setArea({ lat: p.lat, lng: p.lng, label, isCustom: true }, { keepView: true });
      });
    } else {
      areaMarker.setLatLng(latlng);
    }

    drawRadius();
    if (!opts.keepView) pickerMap.setView(latlng, 13);
  }

  /* Draw / update the circle showing the current search radius. */
  function drawRadius() {
    if (!pickerMap || !area) return;
    const radiusM = getRadiusKm() * 1000;
    if (!areaCircle) {
      areaCircle = L.circle([area.lat, area.lng], {
        radius: radiusM, color: "#4f8cff", weight: 1, fillColor: "#4f8cff", fillOpacity: 0.12,
      }).addTo(pickerMap);
    } else {
      areaCircle.setLatLng([area.lat, area.lng]).setRadius(radiusM);
    }
  }

  radiusInput.addEventListener("input", drawRadius);

  /* ---------------------------------------------------------------- */
  /* Search                                                           */
  /* ---------------------------------------------------------------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runSearch();
  });

  function getRadiusKm() {
    const n = Number(radiusInput.value);
    if (!isFinite(n) || n <= 0) return 2;
    return Math.min(7, Math.max(0.2, n));
  }

  /* Snap a minutes value to the 30-minute seating grid. */
  function snap(min, dir) {
    if (dir === "up") return Math.ceil(min / SLOT_STEP) * SLOT_STEP;
    if (dir === "down") return Math.floor(min / SLOT_STEP) * SLOT_STEP;
    return Math.round(min / SLOT_STEP) * SLOT_STEP;
  }

  function runSearch() {
    // Resolve the area: a typed city name wins (and recentres); otherwise use
    // whatever was picked on the map.
    const city = getCity(cityInput.value);
    if (city) area = { lat: city.lat, lng: city.lng, label: city.name, isCustom: false };
    if (!area) {
      return showEmpty("Choose a city, or click a point on the map, to set where you want to dine.");
    }

    const party = Math.max(1, Math.min(20, Math.round(Number(partyInput.value) || 0)));
    if (!party) return showEmpty("Enter how many people you're dining with.");

    const radiusKm = getRadiusKm();
    const dateStr = dateInput.value || new Date().toISOString().slice(0, 10);

    // Build the list of dinner seatings to check.
    let slots, timeLabel;
    if (timeMode === "exact") {
      const t = snap(clampMin(timeToMin(exactTimeInput.value)), "near");
      slots = [t];
      timeLabel = `at ${minToTime(t)}`;
    } else {
      let s = snap(clampMin(timeToMin(startTimeInput.value)), "up");
      let en = snap(clampMin(timeToMin(endTimeInput.value)), "down");
      if (en < s) { const tmp = s; s = en; en = tmp; }
      slots = [];
      for (let m = s; m <= en; m += SLOT_STEP) slots.push(m);
      timeLabel = `between ${minToTime(s)} and ${minToTime(en)}`;
    }

    const seedKey = area.isCustom
      ? `pt:${area.lat.toFixed(3)},${area.lng.toFixed(3)}`
      : area.label;

    const nearby = getRestaurants(area, seedKey, radiusKm);
    if (!nearby.length) {
      return showEmpty(`No restaurants found within ${radiusKm} km of ${escapeHtml(area.label)}. Try widening the search area.`);
    }

    // Keep only restaurants with at least one free, fitting table in the window.
    const matches = [];
    nearby.forEach((r) => {
      const openSlots = [];
      slots.forEach((m) => {
        const seat = seatingAt(r, dateStr, m, party);
        if (seat) openSlots.push({ min: m, seats: seat.seats });
      });
      if (openSlots.length) matches.push({ ...r, openSlots });
    });

    matches.sort((a, b) => a.distance - b.distance);

    renderResults(matches, {
      area, radiusKm, party, dateStr, timeMode, timeLabel,
      slotCount: slots.length, bigParty: party > 12,
    });
  }

  function clampMin(min) {
    return Math.min(DINNER_END_MIN, Math.max(DINNER_START_MIN, min));
  }

  /* ---------------------------------------------------------------- */
  /* Rendering                                                        */
  /* ---------------------------------------------------------------- */
  function renderResults(list, ctx) {
    if (!list.length) {
      const extra = ctx.bigParty
        ? " Parties larger than 12 usually need to call the restaurant directly."
        : " Try a different time, a wider area, or a smaller party.";
      return showEmpty(`No restaurants have a free table for ${ctx.party} ${people(ctx.party)} ${escapeHtml(ctx.timeLabel)} on ${escapeHtml(ctx.dateStr)}.${extra}`);
    }

    const partyText = `${ctx.party} ${people(ctx.party)}`;
    let html = `
      <div class="results-head">
        <h2>${list.length} restaurant${list.length === 1 ? "" : "s"} with a table for ${partyText}
          <span class="live-badge live-on">● Table available</span></h2>
        <span class="sub">Near ${escapeHtml(ctx.area.label)} · within ${ctx.radiusKm} km · ${escapeHtml(datePretty(ctx.dateStr))} · ${escapeHtml(ctx.timeLabel)}</span>
      </div>`;

    html += `<div id="results-map" class="results-map"></div>`;

    const mapPoints = [];
    list.forEach((r, i) => {
      mapPoints.push({ rank: i + 1, name: r.name, lat: r.lat, lng: r.lng, distance: r.distance, emoji: r.emoji });

      const meta = [];
      meta.push(`<span class="star">⭐ <b>${r.rating.toFixed(1)}</b> <span>(${r.reviewCount.toLocaleString()})</span></span>`);
      meta.push(`<span>${"$".repeat(r.priceLevel)}</span>`);
      meta.push(`<span>📍 <b>${r.distance.toFixed(1)} km</b> away</span>`);

      // Availability block: exact = one line; range = chips of free seatings.
      let availability;
      if (ctx.timeMode === "exact") {
        const s = r.openSlots[0];
        availability = `<div class="avail-line">✅ Free at <b>${minToTime(s.min)}</b> · seats you at a <b>${s.seats}-person</b> table</div>`;
      } else {
        const chips = r.openSlots
          .map((s) => `<a class="slot-chip" href="${reserveUrl(r, ctx.party, ctx.dateStr, s.min)}" target="_blank" rel="noopener noreferrer" title="Book a ${s.seats}-person table">${minToTime(s.min)}</a>`)
          .join("");
        availability =
          `<div class="avail-line">✅ <b>${r.openSlots.length}</b> of ${ctx.slotCount} seatings free — pick a time to book:</div>` +
          `<div class="slot-chips">${chips}</div>`;
      }

      // Reserve at the first free seating.
      const first = r.openSlots[0];

      html += `
        <article class="rest-card">
          <div class="rank-badge"><span class="rest-emoji">${r.emoji}</span><span class="rank-n">${i + 1}</span></div>
          <div class="rest-main">
            <div class="rest-top">
              <h3>${escapeHtml(r.name)} <span class="cuisine">${escapeHtml(r.cuisine)}</span></h3>
              <a class="reserve-link" href="${reserveUrl(r, ctx.party, ctx.dateStr, first.min)}" target="_blank" rel="noopener noreferrer">Reserve →</a>
            </div>
            <div class="rest-meta">${meta.join("")}</div>
            ${availability}
          </div>
        </article>`;
    });

    results.innerHTML = html;
    initResultsMap(mapPoints, ctx);
  }

  /* Deep-link to OpenTable pre-filled with the restaurant, party and time. */
  function reserveUrl(rest, party, dateStr, slotMin) {
    const params = new URLSearchParams({
      covers: String(party),
      dateTime: `${dateStr}T${minToTime(slotMin)}`,
      term: rest.name,
    });
    return `https://www.opentable.com/s?${params.toString()}`;
  }

  /* ---------------------------------------------------------------- */
  /* Results map                                                      */
  /* ---------------------------------------------------------------- */
  let resultsMap = null;

  function initResultsMap(points, ctx) {
    const el = document.getElementById("results-map");
    if (!el) return;

    if (typeof L === "undefined") {
      el.classList.add("map-fallback");
      el.textContent = "The map needs an internet connection to load — it works in the live app.";
      return;
    }
    if (resultsMap) { resultsMap.remove(); resultsMap = null; }

    const map = L.map(el, { scrollWheelZoom: false });
    resultsMap = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const bounds = [];
    points.forEach((p) => {
      const icon = L.divIcon({
        className: "map-pin", html: `<span><b>${p.rank}</b></span>`,
        iconSize: [28, 28], iconAnchor: [14, 26], popupAnchor: [0, -24],
      });
      L.marker([p.lat, p.lng], { icon })
        .addTo(map)
        .bindPopup(`<b>${p.rank}. ${p.emoji} ${escapeHtml(p.name)}</b><br>${p.distance.toFixed(1)} km from your area`);
      bounds.push([p.lat, p.lng]);
    });

    // Mark the centre of the search area and its radius.
    const centreIcon = L.divIcon({
      className: "map-poi", html: "<span>🍽️</span>",
      iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -24],
    });
    L.marker([ctx.area.lat, ctx.area.lng], { icon: centreIcon })
      .addTo(map)
      .bindPopup(`<b>${escapeHtml(ctx.area.label)}</b><br>Your search area`);
    L.circle([ctx.area.lat, ctx.area.lng], {
      radius: ctx.radiusKm * 1000, color: "#4f8cff", weight: 1,
      fillColor: "#4f8cff", fillOpacity: 0.08,
    }).addTo(map);
    bounds.push([ctx.area.lat, ctx.area.lng]);

    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
  }

  function showEmpty(msg) {
    if (resultsMap) { resultsMap.remove(); resultsMap = null; }
    results.innerHTML = `<div class="empty">${escapeHtml(msg)}</div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Helpers                                                          */
  /* ---------------------------------------------------------------- */
  function people(n) { return n === 1 ? "person" : "people"; }

  function datePretty(iso) {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* Default the date to today. */
  dateInput.value = new Date().toISOString().slice(0, 10);
  dateInput.min = new Date().toISOString().slice(0, 10);

  initPicker();
})();
