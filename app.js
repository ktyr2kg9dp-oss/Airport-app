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
    amount: $("#amount"),
    keypad: $("#keypad"),
    otherTypes: $("#other-types"),
    cardPicker: $("#card-picker"),
    photoInput: $("#photo-input"),
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

  const CURRENCY = { USD: "$", ILS: "₪" };
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
  const SUBCATEGORY_LABEL = { train: "🚆 Train" };
  const SUBCATEGORY_PLAIN = { train: "Train" };
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
  function setCurrency(currency) {
    sel.currency = currency;
    $$(".cur").forEach((b) => {
      const on = b.dataset.currency === currency;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
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
    if (!isOther) setSubcategory(null);
  }
  function setSubcategory(sub) {
    sel.subcategory = sub;
    $$(".subcat").forEach((b) => b.classList.toggle("active", b.dataset.sub === sub));
  }
  function categoryText(p) {
    if (p.category === "other") return SUBCATEGORY_LABEL[p.subcategory] || "Other";
    return CATEGORY_LABEL[p.category] || "";
  }
  function categoryPlain(p) {
    if (p.category === "other") return SUBCATEGORY_PLAIN[p.subcategory] || "Other";
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

  function resetForm() {
    editingId = null;
    els.formTitle.textContent = "New payment";
    els.submitBtn.textContent = "Add payment";
    els.cancelBtn.hidden = true;

    els.date.value = todayISO();
    setTimeNotRelevant(false);
    els.time.value = nowHM();
    els.amount.value = "";
    closeKeypad();
    sel.method = null;
    $$(".seg").forEach((b) => b.classList.remove("active"));
    els.cardPicker.hidden = true;
    sel.category = null;
    $$(".cat").forEach((b) => b.classList.remove("active"));
    els.otherTypes.hidden = true;
    setSubcategory(null);
    setCurrency("USD");
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
    els.amount.value = p.amount != null ? String(p.amount) : "";
    setCurrency(p.currency || "USD");
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
    if (p.category === "other") setSubcategory(p.subcategory || null);
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
      method: sel.method,
      amount,
      currency: sel.currency,
      card: sel.method === "card" ? sel.card : "",
      category: sel.category,
      subcategory: sel.category === "other" ? sel.subcategory || "" : "",
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
      { key: "date", label: "Date", w: 92 },
      { key: "time", label: "Time", w: 42 },
      { key: "amount", label: "Amount", w: 68, align: "right" },
      { key: "type", label: "Type", w: 92 },
      { key: "method", label: "Card / method", w: 108 },
      { key: "receipt", label: "Receipt", w: 74 },
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
        const caption = `${formatDate(p.date)}${p.time ? " · " + p.time : ""}  —  ${formatAmount(p)}  ·  ${categoryPlain(p)}  ·  ${methodCardText(p)}`;
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

    els.photoInput.addEventListener("change", (e) => {
      handlePhoto(e.target.files && e.target.files[0]);
      e.target.value = "";
    });
    els.photoRemove.addEventListener("click", () => setStagedPhoto(null));
  }

  async function init() {
    wire();
    resetForm();
    try {
      await Store.init();
    } catch (e) {
      /* Store falls back to memory mode internally */
    }
    renderTrips();
    if (Store.activeTripId && activeTrip()) renderPayments();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
