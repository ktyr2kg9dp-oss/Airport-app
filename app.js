/* Oflights application logic */
(function () {
  "use strict";

  const { CITIES, POIS, getHotelsForCity, distanceKm } = window.OflightsData;

  const CRITERIA_LABELS = {
    price: "Price per night",
    review: "Review score",
    distance: "Distance from point of interest",
  };

  /* ---------------------------------------------------------------- */
  /* Mode switch (Flight / Hotel)                                      */
  /* ---------------------------------------------------------------- */
  const modeButtons = document.querySelectorAll(".mode-btn");
  const hotelForm = document.getElementById("hotel-form");
  const flightForm = document.getElementById("flight-form");
  const results = document.getElementById("results");

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeButtons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      const mode = btn.dataset.mode;
      hotelForm.hidden = mode !== "hotel";
      flightForm.hidden = mode !== "flight";
      results.innerHTML = "";
    });
  });

  /* ---------------------------------------------------------------- */
  /* Autocomplete widget                                              */
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
        [...list.children].forEach((li, i) =>
          li.classList.toggle("is-active", i === activeIndex));
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
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) close();
    });
  }

  function matchCities(query) {
    const q = query.trim().toLowerCase();
    return CITIES
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((c) => ({ label: c.name, hint: c.country, value: c.name }));
  }

  function matchPois(cityName, query) {
    const list = POIS[getCityKey(cityName)] || [];
    const q = query.trim().toLowerCase();
    return list
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.type.includes(q))
      .slice(0, 8)
      .map((p) => ({ label: p.name, hint: p.type, value: p.name }));
  }

  function getCityKey(name) {
    const c = CITIES.find((x) => x.name.toLowerCase() === (name || "").trim().toLowerCase());
    return c ? c.name : null;
  }

  /* Wire up the autocompletes */
  const cityWrap = hotelForm.querySelector('[data-field="city"]');
  const poiWrap = hotelForm.querySelector('[data-field="poi"]');
  const cityInput = document.getElementById("hotel-city");
  const poiInput = document.getElementById("hotel-poi");

  attachAutocomplete(cityWrap, matchCities);
  attachAutocomplete(poiWrap, (q) => matchPois(cityInput.value, q));

  // Clearing / changing city resets the POI selection.
  cityInput.addEventListener("ac:select", () => { poiInput.value = ""; });

  attachAutocomplete(flightForm.querySelector('[data-field="from"]'), matchCities);
  attachAutocomplete(flightForm.querySelector('[data-field="to"]'), matchCities);

  /* ---------------------------------------------------------------- */
  /* Criteria ordering (top 3 in priority order)                      */
  /* ---------------------------------------------------------------- */
  const criteriaBoxes = [...hotelForm.querySelectorAll('input[name="criteria"]')];
  const criteriaOrderEl = hotelForm.querySelector(".criteria-order");
  let criteriaOrder = []; // preserves selection order = priority

  criteriaBoxes.forEach((box) => {
    box.addEventListener("change", () => {
      if (box.checked) {
        if (criteriaOrder.length >= 3) {
          box.checked = false; // enforce max 3
          flash(criteriaOrderEl, "You can pick at most 3 criteria.");
          return;
        }
        criteriaOrder.push(box.value);
      } else {
        criteriaOrder = criteriaOrder.filter((v) => v !== box.value);
      }
      renderCriteriaOrder();
    });
  });

  function renderCriteriaOrder() {
    if (!criteriaOrder.length) {
      criteriaOrderEl.textContent = "";
      return;
    }
    criteriaOrderEl.innerHTML = "Priority: " + criteriaOrder
      .map((v, i) => `<b>${i + 1}. ${CRITERIA_LABELS[v]}</b>`)
      .join(" › ");
  }

  let flashTimer;
  function flash(el, msg) {
    const prev = el.innerHTML;
    el.textContent = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { el.innerHTML = prev; }, 1800);
  }

  /* ---------------------------------------------------------------- */
  /* Hotel search + ranking                                           */
  /* ---------------------------------------------------------------- */
  hotelForm.addEventListener("submit", (e) => {
    e.preventDefault();
    runHotelSearch();
  });

  function runHotelSearch() {
    const cityKey = getCityKey(cityInput.value);
    const checkin = document.getElementById("hotel-checkin").value;
    const checkout = document.getElementById("hotel-checkout").value;

    if (!cityKey) {
      return showEmpty("Please choose a city from the list to search hotels.");
    }
    if (!criteriaOrder.length) {
      return showEmpty("Select at least one ranking criterion (up to 3) to sort your results.");
    }

    // Resolve the selected point of interest (needed for distance criterion).
    const poi = (POIS[cityKey] || []).find(
      (p) => p.name.toLowerCase() === poiInput.value.trim().toLowerCase()
    );
    if (criteriaOrder.includes("distance") && !poi) {
      return showEmpty("Choose a point of interest to rank hotels by distance, or remove that criterion.");
    }

    const nights = nightsBetween(checkin, checkout);

    // Build candidate list with computed metrics.
    let hotels = getHotelsForCity(cityKey).map((h) => ({
      ...h,
      distance: poi ? distanceKm(h, poi) : null,
    }));

    hotels = rankHotels(hotels, criteriaOrder);

    renderHotelResults(hotels.slice(0, 5), {
      cityKey, poi, checkin, checkout, nights,
    });
  }

  /*
   * Rank hotels by the chosen criteria in priority order.
   * Each criterion is normalised to a 0..1 score (1 = best) and combined with
   * priority weights (1st pick weighted highest).
   */
  function rankHotels(hotels, order) {
    const ranges = {};
    ["price", "review", "distance"].forEach((key) => {
      const vals = hotels
        .map((h) => metricValue(h, key))
        .filter((v) => v != null);
      ranges[key] = { min: Math.min(...vals), max: Math.max(...vals) };
    });

    const weights = { 0: 3, 1: 2, 2: 1 };

    return hotels
      .map((h) => {
        let score = 0;
        order.forEach((key, idx) => {
          const v = metricValue(h, key);
          if (v == null) return;
          const { min, max } = ranges[key];
          const span = max - min || 1;
          // For price & distance lower is better; for review higher is better.
          let norm = (v - min) / span;
          if (key === "price" || key === "distance") norm = 1 - norm;
          score += norm * weights[idx];
        });
        return { ...h, _score: score };
      })
      .sort((a, b) => b._score - a._score);
  }

  function metricValue(hotel, key) {
    if (key === "price") return hotel.pricePerNight;
    if (key === "review") return hotel.reviewScore;
    if (key === "distance") return hotel.distance;
    return null;
  }

  /* ---------------------------------------------------------------- */
  /* Rendering                                                        */
  /* ---------------------------------------------------------------- */
  function renderHotelResults(hotels, ctx) {
    if (!hotels.length) return showEmpty("No hotels found for this search.");

    const city = CITIES.find((c) => c.name === ctx.cityKey);
    const criteriaText = criteriaOrder.map((v) => CRITERIA_LABELS[v]).join(", ");
    const dateText = ctx.checkin && ctx.checkout
      ? ` · ${ctx.checkin} → ${ctx.checkout} (${ctx.nights} night${ctx.nights === 1 ? "" : "s"})`
      : "";

    let html = `
      <div class="results-head">
        <h2>Top 5 hotels in ${escapeHtml(city.name)}</h2>
        <span class="sub">Ranked by: ${escapeHtml(criteriaText)}${dateText}</span>
      </div>`;

    hotels.forEach((h, i) => {
      const meta = [];
      meta.push(`<span class="star">⭐ <b>${h.reviewScore.toFixed(1)}</b></span> <span>(${h.reviewCount.toLocaleString()} reviews)</span>`);
      if (h.distance != null) {
        meta.push(`<span>📍 <b>${h.distance.toFixed(1)} km</b> from ${escapeHtml(ctx.poi.name)}</span>`);
      }
      const total = ctx.nights ? h.pricePerNight * ctx.nights : null;
      html += `
        <article class="hotel-card">
          <div class="rank-badge">${i + 1}</div>
          <div class="hotel-main">
            <h3>${escapeHtml(h.name)}</h3>
            <div class="hotel-meta">${meta.join("")}</div>
          </div>
          <div class="hotel-price">
            <div class="amt">$${h.pricePerNight}</div>
            <div class="per">per night</div>
            ${total ? `<div class="total">$${total.toLocaleString()} total</div>` : ""}
          </div>
        </article>`;
    });

    results.innerHTML = html;
  }

  function showEmpty(msg) {
    results.innerHTML = `<div class="empty">${escapeHtml(msg)}</div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Flight search (basic companion feature)                          */
  /* ---------------------------------------------------------------- */
  flightForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const from = getCityKey(document.getElementById("flight-from").value);
    const to = getCityKey(document.getElementById("flight-to").value);
    const depart = document.getElementById("flight-depart").value;
    if (!from || !to) return showEmpty("Choose a departure and destination city from the list.");
    if (from === to) return showEmpty("Departure and destination must be different cities.");

    const a = CITIES.find((c) => c.name === from);
    const b = CITIES.find((c) => c.name === to);
    const km = distanceKm(a, b);
    const hours = km / 800; // ~cruising speed
    const price = Math.round(60 + km * 0.09);

    results.innerHTML = `
      <div class="results-head"><h2>Flight ${escapeHtml(from)} → ${escapeHtml(to)}</h2>
        <span class="sub">${depart ? "Departs " + escapeHtml(depart) : "One-way estimate"}</span></div>
      <div class="flight-card">
        <div>
          <div class="flight-route">${escapeHtml(from)} → ${escapeHtml(to)}</div>
          <div class="flight-sub">${km.toFixed(0)} km · about ${hours.toFixed(1)} h flight time</div>
        </div>
        <div class="flight-price">$${price}</div>
      </div>`;
  });

  /* ---------------------------------------------------------------- */
  /* Helpers                                                          */
  /* ---------------------------------------------------------------- */
  function nightsBetween(checkin, checkout) {
    if (!checkin || !checkout) return 0;
    const d = (new Date(checkout) - new Date(checkin)) / 86400000;
    return d > 0 ? Math.round(d) : 0;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* Sensible default dates: tomorrow + 3 nights. */
  (function setDefaultDates() {
    const fmt = (d) => d.toISOString().slice(0, 10);
    const t = new Date(); t.setDate(t.getDate() + 1);
    const out = new Date(t); out.setDate(out.getDate() + 3);
    document.getElementById("hotel-checkin").value = fmt(t);
    document.getElementById("hotel-checkout").value = fmt(out);
    document.getElementById("flight-depart").value = fmt(t);
  })();
})();
