/* Oflights application logic */
(function () {
  "use strict";

  const { CITIES, POIS, getHotelsForCity, distanceKm } = window.OflightsData;

  const CRITERIA_LABELS = {
    price: "Price per night",
    review: "Review score",
    distance: "Distance from point of interest",
    cleanliness: "Cleanliness reviews",
    service: "Service reviews",
  };

  /*
   * Reservation providers. Each result shows three booking "outcomes", one per
   * provider, each with its own price and a working deep-link that runs a real
   * search for that hotel and the chosen dates on the provider's site.
   * `mult` gives each provider a characteristic price level; a per-hotel jitter
   * (added in buildOffers) keeps the cheapest provider from always being the same.
   */
  const PROVIDERS = [
    {
      name: "Booking.com", mult: 1.00,
      url: (q, ci, co) =>
        `https://www.booking.com/searchresults.html?ss=${q}` +
        (ci && co ? `&checkin=${ci}&checkout=${co}` : ""),
    },
    {
      name: "Expedia", mult: 1.06,
      url: (q, ci, co) =>
        `https://www.expedia.com/Hotel-Search?destination=${q}` +
        (ci && co ? `&startDate=${ci}&endDate=${co}` : ""),
    },
    {
      name: "Hotels.com", mult: 0.96,
      url: (q, ci, co) =>
        `https://www.hotels.com/Hotel-Search?destination=${q}` +
        (ci && co ? `&checkIn=${ci}&checkOut=${co}` : ""),
    },
  ];

  /*
   * Build the three reservation outcomes for one hotel. Prices are derived
   * deterministically from the hotel's nightly price so they are stable between
   * reloads. Returns objects sorted cheapest-first.
   */
  function buildOffers(hotel, cityName, checkin, checkout) {
    const query = encodeURIComponent(`${hotel.name}, ${cityName}`);
    return PROVIDERS
      .map((p) => {
        // Deterministic per hotel+provider jitter in the range ~0.95–1.07.
        const rng = seededRandom(hashString(hotel.id + p.name));
        const perNight = Math.round(hotel.pricePerNight * p.mult * (0.95 + rng() * 0.12));
        return { provider: p.name, perNight, url: p.url(query, checkin, checkout) };
      })
      .sort((a, b) => a.perNight - b.perNight);
  }

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

  async function runHotelSearch() {
    // The city may be one of the bundled cities OR any free-typed city (live
    // prices work for anywhere Google Hotels covers).
    const cityRaw = cityInput.value.trim();
    const cityKey = getCityKey(cityRaw);            // bundled match, or null
    const city = cityKey || cityRaw;                // what we actually search
    const checkin = document.getElementById("hotel-checkin").value;
    const checkout = document.getElementById("hotel-checkout").value;

    if (!city) {
      return showEmpty("Please enter a city to search hotels.");
    }
    if (!criteriaOrder.length) {
      return showEmpty("Select at least one ranking criterion (up to 3) to sort your results.");
    }

    // Optional max-distance filter (0–99 km from the point of interest).
    const maxDistance = parseMaxDistance(document.getElementById("hotel-maxdist").value);
    const poiText = poiInput.value.trim();

    if ((criteriaOrder.includes("distance") || maxDistance != null) && !poiText) {
      return showEmpty("Enter a point of interest to use distance ranking or a maximum distance.");
    }

    // Resolve the point of interest to coordinates: bundled first, otherwise
    // geocode it live so distance works for any city / any landmark.
    let poi = (POIS[cityKey] || []).find(
      (p) => p.name.toLowerCase() === poiText.toLowerCase()
    );
    if (!poi && poiText) {
      showEmpty("Locating your point of interest…");
      poi = await geocodePlace(poiText, city);
      if (!poi && (criteriaOrder.includes("distance") || maxDistance != null)) {
        return showEmpty(`Couldn't locate "${poiText}" in ${city}. Check the spelling, or remove the distance options.`);
      }
    }

    const nights = nightsBetween(checkin, checkout);

    // 1) Try LIVE prices from the backend (real Booking.com / Expedia / Hotels.com
    //    rates via Google Hotels). 2) Fall back to bundled sample data if the
    //    server or API key isn't available.
    showEmpty("Searching live prices…");
    const live = await fetchLiveHotels(city, checkin, checkout);

    let hotels, live_mode, notice, asOf;
    if (live && live.hotels.length) {
      hotels = live.hotels.map((h) => ({
        ...h,
        distance: poi && h.lat != null && h.lng != null ? distanceKm(h, poi) : null,
      }));
      live_mode = true;
      asOf = live.asOf;
    } else {
      hotels = getHotelsForCity(cityKey).map((h) => ({
        ...h,
        distance: poi ? distanceKm(h, poi) : null,
      }));
      live_mode = false;
      if (!hotels.length) {
        return showEmpty(`Live prices aren't available right now, and "${city}" isn't one of the built-in sample cities. Start the app with the live server (and your SerpApi key) to search any city.`);
      }
      notice = (live && live.reason) ||
        "Showing sample prices. Run the app with the backend server and a SerpApi key for live prices.";
    }

    // If ranking by distance but live data lacked coordinates, guard it.
    if (criteriaOrder.includes("distance") && hotels.every((h) => h.distance == null)) {
      return showEmpty("Live results didn't include map coordinates, so distance ranking isn't available for this search. Remove the distance criterion or try another city.");
    }

    // Apply the max-distance filter. Hotels without a known distance can't be
    // verified as within range, so they are excluded when a limit is set.
    if (maxDistance != null) {
      const within = hotels.filter((h) => h.distance != null && h.distance <= maxDistance);
      if (!within.length) {
        return showEmpty(`No hotels found within ${maxDistance} km of ${poi.name}. Try increasing the maximum distance.`);
      }
      hotels = within;
    }

    hotels = rankHotels(hotels, criteriaOrder);
    let top = hotels.slice(0, 5);

    // Deep mode: replace cleanliness/service with scores computed from each
    // hotel's real Google reviews, then re-rank the shortlist with those numbers.
    const deep = document.getElementById("hotel-deep").checked;
    let deepNote;
    if (deep && live_mode) {
      showEmpty("🔬 Analyzing real reviews for the top hotels… this can take several seconds.");
      top = await deepAnalyze(top, city);
      top = rankHotels(top, criteriaOrder);
    } else if (deep && !live_mode) {
      deepNote = "Deep review analysis needs the live server (with your API key). Showing summary scores instead.";
    }

    renderHotelResults(top, {
      cityName: city, poi, checkin, checkout, nights, live_mode, notice, asOf, maxDistance,
      deep: deep && live_mode, deepNote,
      showMap: document.getElementById("hotel-map").checked,
    });
  }

  /* Geocode a free-typed place to { name, lat, lng } via the backend, so
   * distances work for any city / landmark. Returns null if unavailable. */
  async function geocodePlace(query, city) {
    try {
      const params = new URLSearchParams({ q: query, city });
      const res = await fetch(`/api/place?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const d = await res.json();
      if (!d.ok) return null;
      return { name: d.name || query, lat: d.lat, lng: d.lng };
    } catch (_) {
      return null;
    }
  }

  /* For each shortlisted hotel, ask the backend to analyse its real reviews and
   * merge the resulting cleanliness/service scores. Runs in parallel. */
  async function deepAnalyze(hotels, city) {
    return Promise.all(hotels.map(async (h) => {
      try {
        const params = new URLSearchParams({ hotel: h.name, city });
        const res = await fetch(`/api/reviews?${params.toString()}`, { headers: { Accept: "application/json" } });
        if (!res.ok) return h;
        const d = await res.json();
        if (!d.ok) return h;
        return {
          ...h,
          cleanliness: d.cleanliness != null ? d.cleanliness : h.cleanliness,
          service: d.service != null ? d.service : h.service,
          deep: true,
          reviewsAnalyzed: d.reviewsAnalyzed,
          cleanlinessCount: d.cleanlinessCount,
          serviceCount: d.serviceCount,
        };
      } catch (_) {
        return h; // network issue → keep summary score
      }
    }));
  }

  /* Ask the backend for live prices. Returns null if unreachable (e.g. the app
   * is opened as a static file with no server behind it). */
  async function fetchLiveHotels(city, checkin, checkout) {
    try {
      const params = new URLSearchParams({ city, checkin, checkout });
      const res = await fetch(`/api/search?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null; // no backend available
    }
  }

  /*
   * Rank hotels by the chosen criteria in priority order.
   * Each criterion is normalised to a 0..1 score (1 = best) and combined with
   * priority weights (1st pick weighted highest).
   */
  function rankHotels(hotels, order) {
    const ranges = {};
    ["price", "review", "distance", "cleanliness", "service"].forEach((key) => {
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
    if (key === "cleanliness") return hotel.cleanliness;
    if (key === "service") return hotel.service;
    return null;
  }

  /* ---------------------------------------------------------------- */
  /* Rendering                                                        */
  /* ---------------------------------------------------------------- */
  function renderHotelResults(hotels, ctx) {
    if (!hotels.length) return showEmpty("No hotels found for this search.");

    const cityName = ctx.cityName;
    const criteriaText = criteriaOrder.map((v) => CRITERIA_LABELS[v]).join(", ");
    const dateText = ctx.checkin && ctx.checkout
      ? ` · ${ctx.checkin} → ${ctx.checkout} (${ctx.nights} night${ctx.nights === 1 ? "" : "s"})`
      : "";

    const asOfText = ctx.live_mode && ctx.asOf
      ? ` · Prices as of ${formatAsOf(ctx.asOf)}`
      : "";

    const distText = ctx.maxDistance != null && ctx.poi
      ? ` · Within ${ctx.maxDistance} km of ${escapeHtml(ctx.poi.name)}`
      : "";

    const badge = ctx.live_mode
      ? `<span class="live-badge live-on">● Live prices</span>`
      : `<span class="live-badge live-off">Sample prices</span>`;

    let html = `
      <div class="results-head">
        <h2>Top 5 hotels in ${escapeHtml(cityName)} ${badge}</h2>
        <span class="sub">Ranked by: ${escapeHtml(criteriaText)}${distText}${dateText}${asOfText}</span>
      </div>`;

    if (!ctx.live_mode && ctx.notice) {
      html += `<div class="notice">${escapeHtml(ctx.notice)}</div>`;
    }
    if (ctx.live_mode) {
      html += `<div class="notice notice-info">Prices are indicative — sourced from Google Hotels and updated periodically. Rooms can sell out or change price, so always confirm the price and availability on the booking site before you pay. Each “Reserve” link opens your exact dates.</div>`;
    }

    if (ctx.deep) {
      html += `<div class="notice notice-info">🔬 Cleanliness &amp; service scores below were computed from these hotels' real Google reviews (with the number of reviews that mentioned each topic). Topics not mentioned in any review are left blank.</div>`;
    }
    if (ctx.deepNote) {
      html += `<div class="notice">${escapeHtml(ctx.deepNote)}</div>`;
    }

    // Warn if a chosen ranking criterion had no data for any shown hotel.
    const missing = criteriaOrder.filter((c) =>
      (c === "cleanliness" || c === "service") && hotels.every((h) => h[c] == null));
    if (missing.length) {
      const names = missing.map((c) => CRITERIA_LABELS[c]).join(" and ");
      html += `<div class="notice">${escapeHtml(names)} weren't reported by Google for these hotels, so they didn't affect the ranking.</div>`;
    }

    if (ctx.showMap) {
      html += `<div id="results-map" class="results-map"></div>`;
    }

    const mapPoints = [];
    currentGalleries = [];
    hotels.forEach((h, i) => {
      currentGalleries[i] = { name: h.name, images: h.images || [] };
      const meta = [];
      if (h.reviewScore != null) {
        const reviews = h.reviewCount ? ` <span>(${h.reviewCount.toLocaleString()} reviews)</span>` : "";
        meta.push(`<span class="star">⭐ <b>${h.reviewScore.toFixed(1)}</b></span>${reviews}`);
      }
      if (h.distance != null) {
        meta.push(`<span>📍 <b>${h.distance.toFixed(1)} km</b> from ${escapeHtml(ctx.poi.name)}</span>`);
      }
      if (h.cleanliness != null) {
        const from = h.deep && h.cleanlinessCount ? ` <span>(${h.cleanlinessCount} reviews)</span>` : "";
        meta.push(`<span>🧼 Cleanliness <b>${h.cleanliness}%</b>${from}</span>`);
      }
      if (h.service != null) {
        const from = h.deep && h.serviceCount ? ` <span>(${h.serviceCount} reviews)</span>` : "";
        meta.push(`<span>🛎️ Service <b>${h.service}%</b>${from}</span>`);
      }

      // Live results carry real per-provider offers; sample results synthesise them.
      const offers = (h.offers && h.offers.length)
        ? h.offers
        : buildOffers(h, cityName, ctx.checkin, ctx.checkout);
      const fromPrice = offers[0].perNight; // cheapest reservation outcome

      if (h.lat != null && h.lng != null) {
        mapPoints.push({ rank: i + 1, name: h.name, lat: h.lat, lng: h.lng, price: fromPrice, url: offers[0].url });
      }

      const offerRows = offers.map((o, idx) => {
        // Compare-only rows (no live price returned for this provider).
        if (o.perNight == null) {
          return `
        <li class="offer offer-compare">
          <span class="offer-provider">${escapeHtml(o.provider)}</span>
          <span class="offer-price offer-check">Check price</span>
          <a class="offer-link is-ghost" href="${o.url}" target="_blank" rel="noopener noreferrer">Compare →</a>
        </li>`;
        }
        const total = ctx.nights ? o.perNight * ctx.nights : null;
        return `
        <li class="offer${idx === 0 ? " is-best" : ""}">
          <span class="offer-provider">${escapeHtml(o.provider)}${idx === 0 ? ' <em>Best price</em>' : ""}</span>
          <span class="offer-price">
            <b>$${o.perNight.toLocaleString()}</b><span class="offer-per"> / night</span>
            ${total ? `<span class="offer-total">$${total.toLocaleString()} total</span>` : ""}
          </span>
          <a class="offer-link" href="${o.url}" target="_blank" rel="noopener noreferrer">Reserve →</a>
        </li>`;
      }).join("");

      html += `
        <article class="hotel-card">
          <div class="rank-badge">${i + 1}</div>
          <div class="hotel-main">
            <div class="hotel-top">
              <h3>${escapeHtml(h.name)}${h.deep && (h.cleanliness != null || h.service != null) ? '<span class="deep-tag">🔬 Real-review analysis</span>' : ""}</h3>
              <div class="hotel-from"><span>from</span> <b>$${fromPrice.toLocaleString()}</b><small>/night</small></div>
            </div>
            <div class="hotel-meta">${meta.join("")}</div>
            ${h.images && h.images.length ? `
            <div class="hotel-photos">
              <button type="button" class="photos-btn" data-g="${i}">
                <img src="${escapeHtml(h.images[0].t)}" alt="" onerror="this.remove()" />
                <span class="cam">📷</span> ${h.images.length} photo${h.images.length === 1 ? "" : "s"}
              </button>
            </div>` : ""}
            <ul class="offers" aria-label="Reservation options for ${escapeHtml(h.name)}">
              ${offerRows}
            </ul>
          </div>
        </article>`;
    });

    results.innerHTML = html;

    if (ctx.showMap) initResultsMap(mapPoints, ctx.poi);
  }

  /* ---------------------------------------------------------------- */
  /* Photo gallery lightbox                                           */
  /* ---------------------------------------------------------------- */
  let currentGalleries = [];
  const gallery = document.getElementById("gallery");
  const gMain = gallery.querySelector(".gallery-main");
  const gThumbs = gallery.querySelector(".gallery-thumbs");
  const gCounter = gallery.querySelector(".gallery-counter");
  const gTitle = gallery.querySelector(".gallery-title");
  let gImages = [], gIndex = 0;

  function openGallery(images, title, start) {
    gImages = images || [];
    gIndex = start || 0;
    gTitle.textContent = title || "Hotel photos";
    if (!gImages.length) return;
    renderGallery();
    gallery.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeGallery() {
    gallery.hidden = true;
    gImages = [];
    gMain.removeAttribute("src");
    document.body.style.overflow = "";
  }
  function stepGallery(delta) {
    if (!gImages.length) return;
    gIndex = (gIndex + delta + gImages.length) % gImages.length;
    renderGallery();
  }
  function renderGallery() {
    const im = gImages[gIndex];
    gMain.src = im.o;
    gCounter.textContent = `${gIndex + 1} / ${gImages.length}`;
    gThumbs.innerHTML = "";
    gImages.forEach((x, i) => {
      const t = document.createElement("img");
      t.src = x.t;
      t.alt = "";
      if (i === gIndex) t.className = "is-active";
      t.addEventListener("click", () => { gIndex = i; renderGallery(); });
      gThumbs.appendChild(t);
    });
  }

  gallery.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close")) closeGallery();
    else if (e.target.hasAttribute("data-prev")) stepGallery(-1);
    else if (e.target.hasAttribute("data-next")) stepGallery(1);
  });
  document.addEventListener("keydown", (e) => {
    if (gallery.hidden) return;
    if (e.key === "Escape") closeGallery();
    else if (e.key === "ArrowLeft") stepGallery(-1);
    else if (e.key === "ArrowRight") stepGallery(1);
  });
  // Open a hotel's gallery when its photos button is clicked (event delegation).
  results.addEventListener("click", (e) => {
    const btn = e.target.closest(".photos-btn");
    if (!btn) return;
    const g = currentGalleries[Number(btn.dataset.g)];
    if (g && g.images.length) openGallery(g.images, g.name, 0);
  });

  /* ---------------------------------------------------------------- */
  /* Results map (Leaflet + OpenStreetMap, no API key needed)         */
  /* ---------------------------------------------------------------- */
  let resultsMap = null;

  function initResultsMap(points, poi) {
    const el = document.getElementById("results-map");
    if (!el) return;

    // Leaflet loads from a CDN; if it's blocked (e.g. the offline preview) or
    // no hotel has coordinates, show a friendly fallback instead of a blank box.
    if (typeof L === "undefined") {
      el.classList.add("map-fallback");
      el.textContent = "The map needs an internet connection to load — it works in the live app.";
      return;
    }
    if (!points.length) {
      el.classList.add("map-fallback");
      el.textContent = "No map coordinates were available for these hotels.";
      return;
    }

    if (resultsMap) { resultsMap.remove(); resultsMap = null; }
    const map = L.map(el, { scrollWheelZoom: false });
    resultsMap = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const bounds = [];
    points.forEach((p) => {
      const icon = L.divIcon({
        className: "map-pin", html: `<span><b>${p.rank}</b></span>`,
        iconSize: [28, 28], iconAnchor: [14, 26], popupAnchor: [0, -24],
      });
      const priceLine = p.price != null ? `<br>from $${Number(p.price).toLocaleString()} / night` : "";
      const link = p.url ? `<br><a href="${p.url}" target="_blank" rel="noopener noreferrer">Reserve →</a>` : "";
      L.marker([p.lat, p.lng], { icon })
        .addTo(map)
        .bindPopup(`<b>${p.rank}. ${escapeHtml(p.name)}</b>${priceLine}${link}`);
      bounds.push([p.lat, p.lng]);
    });

    if (poi && poi.lat != null && poi.lng != null) {
      const poiIcon = L.divIcon({
        className: "map-poi", html: "<span>📍</span>",
        iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -24],
      });
      L.marker([poi.lat, poi.lng], { icon: poiIcon })
        .addTo(map)
        .bindPopup(`<b>${escapeHtml(poi.name)}</b><br>Your point of interest`);
      bounds.push([poi.lat, poi.lng]);
    }

    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
  }

  function showEmpty(msg) {
    if (resultsMap) { resultsMap.remove(); resultsMap = null; }
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

  /* Parse the max-distance input: returns a number clamped to 0–99, or null
   * when the field is empty / not a valid number (meaning "no limit"). */
  function parseMaxDistance(raw) {
    const s = String(raw).trim();
    if (s === "") return null;
    const n = Number(s);
    if (!isFinite(n)) return null;
    return Math.min(99, Math.max(0, n));
  }

  function formatAsOf(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "just now";
    return d.toLocaleString([], {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
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
