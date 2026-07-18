/*
 * Expense Manager — front-end logic.
 *
 * A dependency-free app for logging the payments you make while travelling.
 * Data is stored on-device via the Store layer (IndexedDB, see store.js), so
 * it works offline and keeps many receipt photos durably.
 *
 * Features:
 *   • Trips     — a library of trips; each keeps its own payments.
 *   • Date/Hour — default to today / the current hour ("Not relevant" toggle).
 *   • Amount    — built-in number pad + $ USD / ₪ NIS currency toggle.
 *   • Type      — Food / Uber-taxi / Hotel / Car rent / Other (→ Train, …).
 *   • Method    — Cash / Card / Bank transfer (card ending shown for cards).
 *   • Receipt   — a photo is kept as a light thumbnail (for the list) plus a
 *                 ~1600px full image (for export), stored separately.
 *   • Edit      — tap a saved payment to reopen and fix any of its data.
 *   • Export    — a real PDF per trip, with the full-res receipts attached.
 */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---- element handles --------------------------------------------------
  const els = {
    settingsBtn: $("#settings-btn"),
    settingsOverlay: $("#settings-overlay"),
    settingsClose: $("#settings-close"),
    defaultCurrency: $("#default-currency"),

    newTripBtn: $("#new-trip-btn"),
    newTripRow: $("#new-trip-row"),
    newTripName: $("#new-trip-name"),
    createTripBtn: $("#create-trip-btn"),
    trips: $("#trips"),
    tripsEmpty: $("#trips-empty"),

    form: $("#expense-form"),
    formTitle: $("#form-title"),
    date: $("#date"),
    time: $("#time"),
    timeNa: $("#time-na"),
    location: $("#location"),
    locationBtn: $("#location-btn"),
    amount: $("#amount"),
    keypad: $("#keypad"),
    curDefault: $("#cur-default"),
    curOther: $("#cur-other"),
    currencySelect: $("#currency-select"),
    otherTypes: $("#other-types"),
    otherText: $("#other-text"),
    cardPicker: $("#card-picker"),
    cameraInput: $("#camera-input"),
    uploadInput: $("#upload-input"),
    photoPreview: $("#photo-preview"),
    photoImg: $("#photo-img"),
    photoRemove: $("#photo-remove"),
    formError: $("#form-error"),
    submitBtn: $("#submit-btn"),
    cancelBtn: $("#cancel-btn"),
    resetBtn: $("#reset-btn"),

    paymentsCard: $("#payments-card"),
    paymentsTitle: $("#payments-title"),
    exportBtn: $("#export-btn"),
    totalRow: $("#total-row"),
    total: $("#total"),
    list: $("#list"),
    empty: $("#empty"),
    count: $("#count"),
  };

  // A broad list of currencies (code, symbol, name). Extend freely.
  const CURRENCIES = [
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "ILS", symbol: "₪", name: "Israeli New Shekel" },
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "JPY", symbol: "¥", name: "Japanese Yen" },
    { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
    { code: "AUD", symbol: "A$", name: "Australian Dollar" },
    { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
    { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
    { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
    { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
    { code: "INR", symbol: "₹", name: "Indian Rupee" },
    { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
    { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
    { code: "TRY", symbol: "₺", name: "Turkish Lira" },
    { code: "RUB", symbol: "₽", name: "Russian Ruble" },
    { code: "BRL", symbol: "R$", name: "Brazilian Real" },
    { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
    { code: "ZAR", symbol: "R", name: "South African Rand" },
    { code: "SEK", symbol: "kr", name: "Swedish Krona" },
    { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
    { code: "DKK", symbol: "kr", name: "Danish Krone" },
    { code: "PLN", symbol: "zł", name: "Polish Zloty" },
    { code: "CZK", symbol: "Kč", name: "Czech Koruna" },
    { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
    { code: "THB", symbol: "฿", name: "Thai Baht" },
    { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
    { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
    { code: "PHP", symbol: "₱", name: "Philippine Peso" },
    { code: "KRW", symbol: "₩", name: "South Korean Won" },
    { code: "VND", symbol: "₫", name: "Vietnamese Dong" },
    { code: "EGP", symbol: "E£", name: "Egyptian Pound" },
    { code: "MAD", symbol: "DH", name: "Moroccan Dirham" },
    { code: "ARS", symbol: "$", name: "Argentine Peso" },
    { code: "CLP", symbol: "$", name: "Chilean Peso" },
    { code: "COP", symbol: "$", name: "Colombian Peso" },
    { code: "ISK", symbol: "kr", name: "Icelandic Krona" },
  ];
  const CURRENCY = CURRENCIES.reduce((m, c) => ((m[c.code] = c.symbol), m), {});
  function currencyLabel(code) {
    return `${CURRENCY[code] || ""} ${code}`.trim();
  }
  let defaultCurrency = "USD";
  const METHOD_LABEL = { cash: "💵 Cash", card: "💳 Card", transfer: "🏦 Bank transfer" };
  const METHOD_PLAIN = { cash: "Cash", card: "Card", transfer: "Bank transfer" };
  const CATEGORY_LABEL = {
    food: "🍽️ Food",
    taxi: "🚕 Uber / taxi",
    hotel: "🏨 Hotel",
    carrent: "🚗 Car rent",
    other: "⋯ Other",
  };
  const CATEGORY_PLAIN = {
    food: "Food",
    taxi: "Uber / taxi",
    hotel: "Hotel",
    carrent: "Car rent",
    other: "Other",
  };
  const SUBCATEGORY_LABEL = { train: "🚆 Train", toll: "🛣️ Toll" };
  const SUBCATEGORY_PLAIN = { train: "Train", toll: "Toll" };
  const DEFAULT_CARD = "4255";

  // ---- form selection state --------------------------------------------
  const sel = { method: null, currency: "USD", card: DEFAULT_CARD, category: null, subcategory: null };
  let editingId = null;
  // stagedPhoto: null (none) | { thumb, full } (new) | { thumb, existing: true } (keep)
  let stagedPhoto = null;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // ---- date / time helpers ---------------------------------------------
  function todayISO(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function nowHM(d = new Date()) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function showError(msg) {
    els.formError.textContent = msg;
    els.formError.hidden = false;
  }
  function clearError() {
    els.formError.hidden = true;
  }

  // ---- trips ------------------------------------------------------------
  function activeTrip() {
    return Store.trips.find((t) => t.id === Store.activeTripId) || null;
  }
  function paymentCount(tripId) {
    return Store.payments.filter((p) => p.tripId === tripId).length;
  }

  async function selectTrip(id) {
    await Store.setActiveTrip(id);
    resetForm();
    renderTrips();
    renderPayments();
  }
  async function createTrip(name) {
    const clean = String(name || "").trim().slice(0, 60);
    if (!clean) {
      els.newTripName.focus();
      return;
    }
    const trip = { id: uid(), name: clean, createdAt: Date.now() };
    await Store.saveTrip(trip);
    els.newTripName.value = "";
    els.newTripRow.hidden = true;
    await selectTrip(trip.id);
  }
  async function deleteTrip(id) {
    const trip = Store.trips.find((t) => t.id === id);
    if (!trip) return;
    const count = paymentCount(id);
    const msg = count
      ? `Delete "${trip.name}" and its ${count} payment${count === 1 ? "" : "s"}?`
      : `Delete "${trip.name}"?`;
    if (!window.confirm(msg)) return;
    const wasActive = Store.activeTripId === id;
    await Store.deleteTrip(id);
    if (wasActive) {
      await selectTrip(Store.trips.length ? Store.trips[0].id : null);
    } else {
      renderTrips();
    }
  }

  function renderTrips() {
    const trips = Store.trips.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    els.trips.innerHTML = "";
    els.tripsEmpty.hidden = trips.length > 0;

    for (const t of trips) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "trip-btn" + (t.id === Store.activeTripId ? " active" : "");
      btn.addEventListener("click", () => selectTrip(t.id));

      const name = document.createElement("span");
      name.className = "trip-name";
      name.textContent = t.name;

      const badge = document.createElement("span");
      badge.className = "trip-count";
      badge.textContent = String(paymentCount(t.id));

      const del = document.createElement("span");
      del.className = "trip-del";
      del.setAttribute("role", "button");
      del.setAttribute("aria-label", "Delete trip");
      del.textContent = "✕";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteTrip(t.id);
      });

      btn.append(name, badge, del);
      els.trips.append(btn);
    }

    const hasActive = !!activeTrip();
    els.form.hidden = !hasActive;
    els.paymentsCard.hidden = !hasActive;
  }

  // ---- method / currency / card ----------------------------------------
  function setMethod(method) {
    sel.method = method;
    $$(".seg").forEach((b) => b.classList.toggle("active", b.dataset.method === method));
    const isCard = method === "card";
    els.cardPicker.hidden = !isCard;
    if (isCard) setCard(sel.card || DEFAULT_CARD);
  }
  function populateCurrencyOptions(selectEl) {
    selectEl.innerHTML = "";
    for (const c of CURRENCIES) {
      const opt = document.createElement("option");
      opt.value = c.code;
      opt.textContent = `${c.code} — ${c.name}${c.symbol ? " (" + c.symbol + ")" : ""}`;
      selectEl.append(opt);
    }
  }
  function updateDefaultCurrencyButton() {
    els.curDefault.textContent = currencyLabel(defaultCurrency);
    els.curDefault.dataset.currency = defaultCurrency;
  }
  function setCurrency(currency) {
    sel.currency = currency;
    const isDefault = currency === defaultCurrency;
    els.curDefault.classList.toggle("active", isDefault);
    els.curDefault.setAttribute("aria-pressed", String(isDefault));
    els.curOther.classList.toggle("active", !isDefault);
    els.curOther.setAttribute("aria-pressed", String(!isDefault));
    els.currencySelect.hidden = isDefault;
    if (!isDefault) els.currencySelect.value = currency;
  }
  function setCard(card) {
    sel.card = card;
    $$(".card-btn").forEach((b) => b.classList.toggle("active", b.dataset.card === card));
  }

  // ---- type of expense --------------------------------------------------
  function setCategory(category) {
    sel.category = category;
    $$(".cat").forEach((b) => b.classList.toggle("active", b.dataset.cat === category));
    const isOther = category === "other";
    els.otherTypes.hidden = !isOther;
    if (!isOther) setSubcategory("");
  }
  // subcategory is free text; the Train / Toll buttons are quick fills.
  function setSubcategory(text) {
    const val = text || "";
    sel.subcategory = val;
    if (els.otherText.value !== val) els.otherText.value = val;
    $$(".subcat").forEach((b) =>
      b.classList.toggle("active", b.dataset.sub.toLowerCase() === val.trim().toLowerCase())
    );
  }
  function categoryText(p) {
    if (p.category === "other") {
      const s = (p.subcategory || "").trim();
      return SUBCATEGORY_LABEL[s.toLowerCase()] || s || "Other";
    }
    return CATEGORY_LABEL[p.category] || "";
  }
  function categoryPlain(p) {
    if (p.category === "other") {
      const s = (p.subcategory || "").trim();
      return SUBCATEGORY_PLAIN[s.toLowerCase()] || s || "Other";
    }
    return CATEGORY_PLAIN[p.category] || "";
  }

  // ---- built-in number pad ---------------------------------------------
  function openKeypad() {
    els.keypad.hidden = false;
  }
  function closeKeypad() {
    els.keypad.hidden = true;
  }
  function pressKey(key) {
    let v = els.amount.value;
    if (key === "done") {
      closeKeypad();
      return;
    }
    if (key === "back") {
      v = v.slice(0, -1);
    } else if (key === ".") {
      if (!v.includes(".")) v = v === "" ? "0." : v + ".";
    } else {
      if (v === "0") v = key;
      else v += key;
      const dot = v.indexOf(".");
      if (dot !== -1 && v.length - dot > 3) return;
    }
    els.amount.value = v;
  }

  // ---- receipt photo (light thumbnail + ~1600px full) ------------------
  function scaleToDataURL(img, max, quality) {
    let { width, height } = img;
    if (width >= height && width > max) {
      height = Math.round((height * max) / width);
      width = max;
    } else if (height > width && height > max) {
      width = Math.round((width * max) / height);
      height = max;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  }
  function handlePhoto(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setStagedPhoto({
          full: scaleToDataURL(img, 1600, 0.82),
          thumb: scaleToDataURL(img, 240, 0.6),
        });
      };
      img.onerror = () => showError("That image couldn't be read. Try another photo.");
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function setStagedPhoto(staged) {
    stagedPhoto = staged || null;
    if (stagedPhoto && stagedPhoto.thumb) {
      els.photoImg.src = stagedPhoto.thumb;
      els.photoPreview.hidden = false;
    } else {
      els.photoImg.removeAttribute("src");
      els.photoPreview.hidden = true;
    }
  }

  // ---- form: defaults / edit / submit ----------------------------------
  function setTimeNotRelevant(on) {
    els.timeNa.setAttribute("aria-pressed", String(on));
    els.timeNa.classList.toggle("active", on);
    els.time.disabled = on;
    if (on) els.time.value = "";
    else if (!els.time.value) els.time.value = nowHM();
  }
  function isTimeNotRelevant() {
    return els.timeNa.getAttribute("aria-pressed") === "true";
  }

  // ---- location (geolocation + reverse geocode, best-effort) -----------
  let lastDetectedLocation = "";
  let locationAttempted = false;

  function applyDetectedLocation(place) {
    lastDetectedLocation = place;
    // Only fill if the user hasn't typed their own location.
    if (!els.location.value || els.location.dataset.auto === "1") {
      els.location.value = place;
      els.location.dataset.auto = "1";
    }
  }
  function detectLocation() {
    if (!("geolocation" in navigator)) {
      els.location.placeholder = "Type a location";
      return;
    }
    locationAttempted = true;
    els.location.placeholder = "Detecting current location…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const coords = `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
        fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        )
          .then((r) => r.json())
          .then((j) => {
            const place = [j.city || j.locality || j.principalSubdivision, j.countryName]
              .filter(Boolean)
              .join(", ");
            applyDetectedLocation(place || coords);
          })
          .catch(() => applyDetectedLocation(coords));
      },
      () => {
        els.location.placeholder = "Type a location";
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }

  function resetForm() {
    editingId = null;
    els.formTitle.textContent = "New payment";
    els.submitBtn.textContent = "Add payment";
    els.cancelBtn.hidden = true;

    els.date.value = todayISO();
    setTimeNotRelevant(false);
    els.time.value = nowHM();
    els.location.value = lastDetectedLocation || "";
    els.location.dataset.auto = lastDetectedLocation ? "1" : "0";
    if (!lastDetectedLocation && !locationAttempted) detectLocation();
    els.amount.value = "";
    closeKeypad();
    sel.method = null;
    $$(".seg").forEach((b) => b.classList.remove("active"));
    els.cardPicker.hidden = true;
    sel.category = null;
    $$(".cat").forEach((b) => b.classList.remove("active"));
    els.otherTypes.hidden = true;
    setSubcategory("");
    setCurrency(defaultCurrency);
    setCard(DEFAULT_CARD);
    setStagedPhoto(null);
    clearError();
  }

  function editPayment(id) {
    const p = Store.payments.find((x) => x.id === id);
    if (!p) return;
    editingId = id;
    els.formTitle.textContent = "Edit payment";
    els.submitBtn.textContent = "Save payment";
    els.cancelBtn.hidden = false;

    els.date.value = p.date;
    if (p.time) {
      setTimeNotRelevant(false);
      els.time.value = p.time;
    } else {
      setTimeNotRelevant(true);
    }
    els.location.value = p.location || "";
    els.location.dataset.auto = "0";
    els.amount.value = p.amount != null ? String(p.amount) : "";
    setCurrency(p.currency || defaultCurrency);
    if (p.method) setMethod(p.method);
    else {
      sel.method = null;
      $$(".seg").forEach((b) => b.classList.remove("active"));
      els.cardPicker.hidden = true;
    }
    if (p.method === "card") setCard(p.card || DEFAULT_CARD);
    if (p.category) setCategory(p.category);
    else {
      sel.category = null;
      $$(".cat").forEach((b) => b.classList.remove("active"));
      els.otherTypes.hidden = true;
    }
    if (p.category === "other") setSubcategory(p.subcategory || "");
    setStagedPhoto(p.hasPhoto ? { thumb: p.thumb, existing: true } : null);
    clearError();
    closeKeypad();
    els.form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submitForm(e) {
    e.preventDefault();
    clearError();

    if (!Store.activeTripId) {
      showError("Create or select a trip first.");
      return;
    }
    if (!els.date.value) {
      showError("Please choose a date.");
      return;
    }
    if (!sel.method) {
      showError("Please choose a payment method.");
      return;
    }
    if (!sel.category) {
      showError("Please choose a type of expense.");
      return;
    }
    const amount = parseFloat(els.amount.value);
    if (!(amount > 0)) {
      showError("Please enter an amount greater than zero.");
      openKeypad();
      return;
    }

    const existing = editingId ? Store.payments.find((x) => x.id === editingId) : null;
    const meta = {
      id: editingId || uid(),
      tripId: existing ? existing.tripId : Store.activeTripId,
      createdAt: existing ? existing.createdAt : Date.now(),
      date: els.date.value,
      time: isTimeNotRelevant() ? "" : els.time.value || "",
      location: els.location.value.trim(),
      method: sel.method,
      amount,
      currency: sel.currency,
      card: sel.method === "card" ? sel.card : "",
      category: sel.category,
      subcategory: sel.category === "other" ? sel.subcategory.trim() : "",
      thumb: "",
      hasPhoto: false,
    };
    if (editingId) meta.updatedAt = Date.now();

    // Decide what happens to the full-res photo record.
    let fullArg; // undefined = leave as-is; null = remove; string = write
    if (stagedPhoto == null) {
      meta.hasPhoto = false;
      meta.thumb = "";
      fullArg = null;
    } else if (stagedPhoto.existing) {
      meta.hasPhoto = true;
      meta.thumb = stagedPhoto.thumb || "";
      fullArg = undefined;
    } else {
      meta.hasPhoto = true;
      meta.thumb = stagedPhoto.thumb || "";
      fullArg = stagedPhoto.full;
    }

    try {
      await Store.savePayment(meta, fullArg);
    } catch (err) {
      showError("Couldn't save — device storage may be full. Try removing a receipt photo.");
      return;
    }
    resetForm();
    renderTrips();
    renderPayments();
  }

  async function deletePayment(id) {
    await Store.deletePayment(id);
    if (editingId === id) resetForm();
    renderTrips();
    renderPayments();
  }

  // ---- rendering payments ----------------------------------------------
  function formatAmount(p) {
    const symbol = CURRENCY[p.currency] || "";
    const value = Number(p.amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${symbol}${value}`;
  }
  function methodDescription(p) {
    let label = METHOD_LABEL[p.method] || p.method || "";
    if (p.method === "card" && p.card) label += ` •••• ${p.card}`;
    return label;
  }
  function methodCardText(p) {
    if (p.method === "card") return "Card •••• " + (p.card || "");
    return METHOD_PLAIN[p.method] || "";
  }

  function tripPayments(tripId) {
    return Store.payments
      .filter((p) => p.tripId === tripId)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        const ta = a.time || "";
        const tb = b.time || "";
        if (ta !== tb) return ta < tb ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }

  function currencyTotals(payments) {
    const totals = {};
    for (const p of payments) totals[p.currency] = (totals[p.currency] || 0) + Number(p.amount || 0);
    return Object.keys(totals).map(
      (cur) =>
        `${CURRENCY[cur] || ""}${totals[cur].toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
    );
  }

  function renderPayments() {
    const trip = activeTrip();
    if (!trip) return;
    els.paymentsTitle.textContent = `Payments · ${trip.name}`;

    const payments = tripPayments(Store.activeTripId);
    els.count.textContent = String(payments.length);
    els.list.innerHTML = "";
    els.empty.hidden = payments.length > 0;
    els.exportBtn.hidden = payments.length === 0;

    els.totalRow.hidden = payments.length === 0;
    els.total.textContent = currencyTotals(payments).join("  ·  ");

    for (const p of payments) {
      const li = document.createElement("li");
      li.className = "item";
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.addEventListener("click", () => editPayment(p.id));
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          editPayment(p.id);
        }
      });

      if (p.hasPhoto && p.thumb) {
        const thumb = document.createElement("img");
        thumb.className = "item-thumb";
        thumb.src = p.thumb;
        thumb.alt = "Receipt";
        li.append(thumb);
      }

      const info = document.createElement("div");
      info.className = "item-info";

      const topLine = document.createElement("div");
      topLine.className = "item-top";
      const dateLine = document.createElement("span");
      dateLine.className = "item-date";
      dateLine.textContent = formatDate(p.date);
      const amountLine = document.createElement("span");
      amountLine.className = "item-amount";
      amountLine.textContent = formatAmount(p);
      topLine.append(dateLine, amountLine);

      const metaLine = document.createElement("span");
      metaLine.className = "item-meta";
      const timeText = p.time ? p.time : "no time";
      const catText = categoryText(p);
      metaLine.textContent =
        `${timeText}${catText ? " · " + catText : ""} · ${methodDescription(p)}${p.hasPhoto ? " · 📎" : ""}`;

      info.append(topLine, metaLine);

      if (p.location) {
        const locLine = document.createElement("span");
        locLine.className = "item-loc";
        locLine.textContent = "📍 " + p.location;
        info.append(locLine);
      }

      const del = document.createElement("button");
      del.type = "button";
      del.className = "item-del";
      del.setAttribute("aria-label", "Delete payment");
      del.textContent = "✕";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deletePayment(p.id);
      });

      li.append(info, del);
      els.list.append(li);
    }
  }

  // ---- export a trip to a real PDF (with full-res receipts) ------------
  function safeFileName(name) {
    return String(name).trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "trip";
  }

  async function exportTrip() {
    const trip = activeTrip();
    if (!trip) return;
    if (!(window.jspdf && window.jspdf.jsPDF)) {
      showError("PDF export isn't available (the PDF library didn't load).");
      return;
    }

    // Chronological order reads best in a statement.
    const payments = Store.payments
      .filter((p) => p.tripId === Store.activeTripId)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (a.time || "").localeCompare(b.time || "");
      });
    if (!payments.length) return;

    els.exportBtn.disabled = true;
    const prevLabel = els.exportBtn.textContent;
    els.exportBtn.textContent = "Preparing…";
    try {
      // Fetch the full-resolution receipt images up front.
      const fulls = {};
      for (const p of payments) {
        if (p.hasPhoto) fulls[p.id] = await Store.getPhoto(p.id);
      }
      buildPdf(trip, payments, fulls);
    } catch (err) {
      showError("Something went wrong building the PDF.");
    } finally {
      els.exportBtn.disabled = false;
      els.exportBtn.textContent = prevLabel;
    }
  }

  function buildPdf(trip, payments, fulls) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 40; // margin
    const teal = [15, 118, 110];
    const grey = [110, 120, 130];
    const line = [225, 230, 236];

    // ----- header -----
    let y = M + 6;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(trip.name, M, y);
    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(grey[0], grey[1], grey[2]);
    doc.text("Exported " + new Date().toLocaleString(), M, y);
    y += 14;
    const totalText = currencyTotals(payments).join("   ·   ");
    doc.text(`${payments.length} payment${payments.length === 1 ? "" : "s"}   ·   Total ${totalText}`, M, y);
    y += 22;

    // ----- table -----
    const cols = [
      { key: "date", label: "Date", w: 80 },
      { key: "time", label: "Time", w: 34 },
      { key: "amount", label: "Amount", w: 60, align: "right" },
      { key: "type", label: "Type", w: 72 },
      { key: "location", label: "Location", w: 84 },
      { key: "method", label: "Card / method", w: 92 },
      { key: "receipt", label: "Receipt", w: 44 },
    ];
    const rowH = 40;
    const startX = M;

    function drawHeader() {
      doc.setFillColor(241, 245, 249);
      doc.rect(startX, y, pageW - M * 2, 22, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      let x = startX + 6;
      for (const c of cols) {
        const tx = c.align === "right" ? x + c.w - 6 : x;
        doc.text(c.label.toUpperCase(), tx, y + 15, { align: c.align === "right" ? "right" : "left" });
        x += c.w;
      }
      y += 22;
    }

    drawHeader();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);

    for (const p of payments) {
      if (y + rowH > pageH - M) {
        doc.addPage();
        y = M;
        drawHeader();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
      }
      const cellY = y + rowH / 2 + 3;
      let x = startX + 6;
      doc.setTextColor(15, 23, 42);
      const values = {
        date: formatDate(p.date),
        time: p.time || "—",
        amount: formatAmount(p),
        type: categoryPlain(p),
        location: p.location || "—",
        method: methodCardText(p),
      };
      for (const c of cols) {
        if (c.key === "receipt") {
          if (p.hasPhoto && fulls[p.id]) {
            try {
              doc.addImage(fulls[p.id], "JPEG", x, y + 5, 30, 30);
            } catch (e) {
              /* skip a bad image */
            }
          } else {
            doc.setTextColor(grey[0], grey[1], grey[2]);
            doc.text("—", x, cellY);
            doc.setTextColor(15, 23, 42);
          }
        } else {
          const tx = c.align === "right" ? x + c.w - 6 : x;
          const text = doc.splitTextToSize(String(values[c.key] || ""), c.w - 8)[0] || "";
          doc.text(text, tx, cellY, { align: c.align === "right" ? "right" : "left" });
        }
        x += c.w;
      }
      doc.setDrawColor(line[0], line[1], line[2]);
      doc.line(startX, y + rowH, pageW - M, y + rowH);
      y += rowH;
    }

    // ----- receipts appendix (full-size images) -----
    const withPhotos = payments.filter((p) => p.hasPhoto && fulls[p.id]);
    if (withPhotos.length) {
      doc.addPage();
      y = M + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(teal[0], teal[1], teal[2]);
      doc.text("Receipts", M, y);
      doc.setTextColor(15, 23, 42);

      for (const p of withPhotos) {
        doc.addPage();
        const caption = `${formatDate(p.date)}${p.time ? " · " + p.time : ""}  —  ${formatAmount(p)}  ·  ${categoryPlain(p)}  ·  ${methodCardText(p)}${p.location ? "  ·  " + p.location : ""}`;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(grey[0], grey[1], grey[2]);
        doc.text(doc.splitTextToSize(caption, pageW - M * 2), M, M);
        doc.setTextColor(15, 23, 42);

        let props;
        try {
          props = doc.getImageProperties(fulls[p.id]);
        } catch (e) {
          continue;
        }
        const availW = pageW - M * 2;
        const availH = pageH - M * 2 - 24;
        let w = availW;
        let h = (w * props.height) / props.width;
        if (h > availH) {
          h = availH;
          w = (h * props.width) / props.height;
        }
        const ix = (pageW - w) / 2;
        const iy = M + 18;
        try {
          doc.addImage(fulls[p.id], "JPEG", ix, iy, w, h);
        } catch (e) {
          /* skip */
        }
      }
    }

    doc.save(safeFileName(trip.name) + "-expenses.pdf");
  }

  // ---- wiring -----------------------------------------------------------
  function wire() {
    els.newTripBtn.addEventListener("click", () => {
      els.newTripRow.hidden = !els.newTripRow.hidden;
      if (!els.newTripRow.hidden) els.newTripName.focus();
    });
    els.createTripBtn.addEventListener("click", () => createTrip(els.newTripName.value));
    els.newTripName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        createTrip(els.newTripName.value);
      }
    });

    els.form.addEventListener("submit", submitForm);
    els.resetBtn.addEventListener("click", resetForm);
    els.cancelBtn.addEventListener("click", resetForm);
    els.timeNa.addEventListener("click", () => setTimeNotRelevant(!isTimeNotRelevant()));

    els.amount.addEventListener("focus", openKeypad);
    els.amount.addEventListener("click", openKeypad);
    els.keypad.addEventListener("click", (e) => {
      const key = e.target.closest(".key");
      if (key) pressKey(key.dataset.key);
    });

    $$(".seg").forEach((b) => b.addEventListener("click", () => setMethod(b.dataset.method)));
    $$(".cur").forEach((b) => b.addEventListener("click", () => setCurrency(b.dataset.currency)));
    $$(".card-btn").forEach((b) => b.addEventListener("click", () => setCard(b.dataset.card)));
    $$(".cat").forEach((b) => b.addEventListener("click", () => setCategory(b.dataset.cat)));
    $$(".subcat").forEach((b) => b.addEventListener("click", () => setSubcategory(b.dataset.sub)));

    els.exportBtn.addEventListener("click", exportTrip);

    // Location.
    els.locationBtn.addEventListener("click", () => {
      els.location.dataset.auto = "1";
      detectLocation();
    });
    els.location.addEventListener("input", () => {
      els.location.dataset.auto = "0";
    });

    // Currency: default button, Other, and the full list.
    els.curDefault.addEventListener("click", () => setCurrency(defaultCurrency));
    els.curOther.addEventListener("click", () => {
      let code = els.currencySelect.value;
      if (!code || code === defaultCurrency) {
        const alt = CURRENCIES.find((c) => c.code !== defaultCurrency);
        code = alt ? alt.code : defaultCurrency;
        els.currencySelect.value = code;
      }
      setCurrency(code);
    });
    els.currencySelect.addEventListener("change", () => setCurrency(els.currencySelect.value));

    // Type "Other" free-text.
    els.otherText.addEventListener("input", () => setSubcategory(els.otherText.value));

    // Receipt: camera + upload.
    els.cameraInput.addEventListener("change", (e) => {
      handlePhoto(e.target.files && e.target.files[0]);
      e.target.value = "";
    });
    els.uploadInput.addEventListener("change", (e) => {
      handlePhoto(e.target.files && e.target.files[0]);
      e.target.value = "";
    });
    els.photoRemove.addEventListener("click", () => setStagedPhoto(null));

    // Settings.
    els.settingsBtn.addEventListener("click", openSettings);
    els.settingsClose.addEventListener("click", closeSettings);
    els.settingsOverlay.addEventListener("click", (e) => {
      if (e.target === els.settingsOverlay) closeSettings();
    });
    els.defaultCurrency.addEventListener("change", () => {
      setDefaultCurrency(els.defaultCurrency.value, true);
      if (!editingId) setCurrency(defaultCurrency);
    });
  }

  // ---- settings ---------------------------------------------------------
  function setDefaultCurrency(code, persist) {
    defaultCurrency = code || "USD";
    updateDefaultCurrencyButton();
    els.defaultCurrency.value = defaultCurrency;
    if (persist) Store.setSetting("defaultCurrency", defaultCurrency);
  }
  function openSettings() {
    els.defaultCurrency.value = defaultCurrency;
    els.settingsOverlay.hidden = false;
  }
  function closeSettings() {
    els.settingsOverlay.hidden = true;
  }

  async function init() {
    wire();
    populateCurrencyOptions(els.currencySelect);
    populateCurrencyOptions(els.defaultCurrency);
    try {
      await Store.init();
    } catch (e) {
      /* Store falls back to memory mode internally */
    }
    defaultCurrency = Store.getSetting("defaultCurrency", "USD");
    updateDefaultCurrencyButton();
    els.defaultCurrency.value = defaultCurrency;
    // Seed the "Other currency" list with something other than the default.
    if (els.currencySelect.value === defaultCurrency) {
      const alt = CURRENCIES.find((c) => c.code !== defaultCurrency);
      if (alt) els.currencySelect.value = alt.code;
    }
    resetForm();
    renderTrips();
    if (Store.activeTripId && activeTrip()) renderPayments();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
