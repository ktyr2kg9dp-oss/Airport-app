/*
 * Expense Manager — front-end logic.
 *
 * A small, dependency-free app for logging the payments you make while
 * travelling. Everything is stored locally in the browser (localStorage), so
 * it works offline and your data stays on your own device.
 *
 * Features:
 *   • Trips     — a library of trips; each trip keeps its own payments.
 *   • Date      — defaults to today every time the app is opened.
 *   • Hour      — defaults to the current hour, with a "Not relevant" toggle.
 *   • Amount    — built-in number pad + $ USD / ₪ NIS currency toggle.
 *   • Method    — Cash / Card / Bank transfer (card ending shown for cards).
 *   • Receipt   — snap or attach a photo of the receipt.
 *   • Edit      — tap a saved payment to reopen and fix any of its data.
 */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const LS_TRIPS = "expense-manager.trips";
  const LS_PAYMENTS = "expense-manager.payments";
  const LS_ACTIVE = "expense-manager.activeTrip";

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
  // Sub-types shown when "Other" is chosen (more to be added later).
  const SUBCATEGORY_LABEL = { train: "🚆 Train" };
  const DEFAULT_CARD = "4255";

  // ---- app state --------------------------------------------------------
  const sel = { method: null, currency: "USD", card: DEFAULT_CARD, category: null, subcategory: null };
  let activeTripId = null;
  let editingId = null; // payment id being edited, or null for a new one
  let stagedPhoto = null; // data URL of the receipt photo attached to the form

  // ---- storage ----------------------------------------------------------
  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }
  function loadTrips() {
    const t = readJSON(LS_TRIPS, []);
    return Array.isArray(t) ? t : [];
  }
  function saveTrips(trips) {
    localStorage.setItem(LS_TRIPS, JSON.stringify(trips));
  }
  function loadPayments() {
    const p = readJSON(LS_PAYMENTS, []);
    return Array.isArray(p) ? p : [];
  }
  function savePayments(payments) {
    try {
      localStorage.setItem(LS_PAYMENTS, JSON.stringify(payments));
      return true;
    } catch (err) {
      // Most likely the storage quota was exceeded (e.g. too many photos).
      showError("Couldn't save — device storage is full. Try removing a receipt photo.");
      return false;
    }
  }

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
    return loadTrips().find((t) => t.id === activeTripId) || null;
  }

  function selectTrip(id) {
    activeTripId = id;
    localStorage.setItem(LS_ACTIVE, id || "");
    exitEditMode();
    resetForm();
    renderTrips();
    renderPayments();
  }

  function createTrip(name) {
    const clean = String(name || "").trim().slice(0, 60);
    if (!clean) {
      els.newTripName.focus();
      return;
    }
    const trips = loadTrips();
    const trip = { id: uid(), name: clean, createdAt: Date.now() };
    trips.push(trip);
    saveTrips(trips);
    els.newTripName.value = "";
    els.newTripRow.hidden = true;
    selectTrip(trip.id);
  }

  function deleteTrip(id) {
    const trips = loadTrips();
    const trip = trips.find((t) => t.id === id);
    if (!trip) return;
    const count = loadPayments().filter((p) => p.tripId === id).length;
    const msg = count
      ? `Delete "${trip.name}" and its ${count} payment${count === 1 ? "" : "s"}?`
      : `Delete "${trip.name}"?`;
    if (!window.confirm(msg)) return;
    saveTrips(trips.filter((t) => t.id !== id));
    savePayments(loadPayments().filter((p) => p.tripId !== id));
    if (activeTripId === id) {
      const remaining = loadTrips();
      selectTrip(remaining.length ? remaining[0].id : null);
    } else {
      renderTrips();
    }
  }

  function renderTrips() {
    const trips = loadTrips().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    els.trips.innerHTML = "";
    els.tripsEmpty.hidden = trips.length > 0;

    for (const t of trips) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "trip-btn" + (t.id === activeTripId ? " active" : "");
      btn.addEventListener("click", () => selectTrip(t.id));

      const name = document.createElement("span");
      name.className = "trip-name";
      name.textContent = t.name;

      const count = loadPayments().filter((p) => p.tripId === t.id).length;
      const badge = document.createElement("span");
      badge.className = "trip-count";
      badge.textContent = String(count);

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

    // Show/hide the form + payments depending on whether a trip is open.
    const hasActive = !!activeTrip();
    els.form.hidden = !hasActive;
    els.paymentsCard.hidden = !hasActive;
  }

  // ---- payment method / currency / card --------------------------------
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

  // ---- type of expense (category + "Other" sub-types) ------------------
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
  // Display label for a payment's expense type.
  function categoryText(p) {
    if (p.category === "other") return SUBCATEGORY_LABEL[p.subcategory] || "Other";
    return CATEGORY_LABEL[p.category] || "";
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
      // digit
      if (v === "0") v = key; // replace a lone leading zero
      else v += key;
      // keep at most two decimals
      const dot = v.indexOf(".");
      if (dot !== -1 && v.length - dot > 3) return;
    }
    els.amount.value = v;
  }

  // ---- receipt photo ----------------------------------------------------
  function handlePhoto(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale so receipts don't blow past the storage quota.
        const max = 1024;
        let { width, height } = img;
        if (width > height && width > max) {
          height = Math.round((height * max) / width);
          width = max;
        } else if (height > max) {
          width = Math.round((width * max) / height);
          height = max;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        setStagedPhoto(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = () => showError("That image couldn't be read. Try another photo.");
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function setStagedPhoto(dataUrl) {
    stagedPhoto = dataUrl || null;
    if (stagedPhoto) {
      els.photoImg.src = stagedPhoto;
      els.photoPreview.hidden = false;
    } else {
      els.photoImg.removeAttribute("src");
      els.photoPreview.hidden = true;
    }
  }

  // ---- form: defaults, edit, submit ------------------------------------
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

  function editPayment(id) {
    const p = loadPayments().find((x) => x.id === id);
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
    setStagedPhoto(p.photo || null);
    clearError();
    closeKeypad();

    els.form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exitEditMode() {
    editingId = null;
  }

  function submitForm(e) {
    e.preventDefault();
    clearError();

    if (!activeTripId) {
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

    const payments = loadPayments();
    const fields = {
      date: els.date.value,
      time: isTimeNotRelevant() ? "" : els.time.value || "",
      method: sel.method,
      amount,
      currency: sel.currency,
      card: sel.method === "card" ? sel.card : "",
      category: sel.category,
      subcategory: sel.category === "other" ? sel.subcategory || "" : "",
      photo: stagedPhoto || "",
    };

    if (editingId) {
      const idx = payments.findIndex((x) => x.id === editingId);
      if (idx !== -1) {
        payments[idx] = Object.assign({}, payments[idx], fields, { updatedAt: Date.now() });
      }
    } else {
      payments.push(
        Object.assign(
          { id: uid(), tripId: activeTripId, createdAt: Date.now() },
          fields
        )
      );
    }

    if (!savePayments(payments)) return; // quota error already surfaced
    resetForm();
    renderTrips(); // refresh per-trip counts
    renderPayments();
  }

  function deletePayment(id) {
    savePayments(loadPayments().filter((p) => p.id !== id));
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

  function renderPayments() {
    const trip = activeTrip();
    if (!trip) return;

    els.paymentsTitle.textContent = `Payments · ${trip.name}`;

    const payments = loadPayments()
      .filter((p) => p.tripId === activeTripId)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        const ta = a.time || "";
        const tb = b.time || "";
        if (ta !== tb) return ta < tb ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

    els.count.textContent = String(payments.length);
    els.list.innerHTML = "";
    els.empty.hidden = payments.length > 0;

    // Totals, grouped by currency (mixing currencies can't be summed).
    const totals = {};
    for (const p of payments) {
      totals[p.currency] = (totals[p.currency] || 0) + Number(p.amount || 0);
    }
    const totalParts = Object.keys(totals).map((cur) =>
      `${CURRENCY[cur] || ""}${totals[cur].toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    );
    els.totalRow.hidden = payments.length === 0;
    els.total.textContent = totalParts.join("  ·  ");
    els.exportBtn.hidden = payments.length === 0;

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

      if (p.photo) {
        const thumb = document.createElement("img");
        thumb.className = "item-thumb";
        thumb.src = p.photo;
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
        `${timeText}${catText ? " · " + catText : ""} · ${methodDescription(p)}${p.photo ? " · 📎" : ""}`;

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

  // ---- export a trip to a self-contained HTML report -------------------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }
  function methodCardText(p) {
    if (p.method === "card") return "Card •••• " + (p.card || "");
    return METHOD_PLAIN[p.method] || "";
  }
  function safeFileName(name) {
    return (String(name).trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "trip");
  }

  function exportTrip() {
    const trip = activeTrip();
    if (!trip) return;
    const payments = loadPayments()
      .filter((p) => p.tripId === activeTripId)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1; // chronological for a statement
        return (a.time || "").localeCompare(b.time || "");
      });
    if (!payments.length) return;

    const totals = {};
    for (const p of payments) totals[p.currency] = (totals[p.currency] || 0) + Number(p.amount || 0);
    const totalText = Object.keys(totals)
      .map((cur) => `${CURRENCY[cur] || ""}${totals[cur].toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`)
      .join("  ·  ");

    const rows = payments
      .map((p) => {
        const thumb = p.photo
          ? `<a href="#" class="thumb-link" data-full="${esc(p.photo)}"><img class="thumb" src="${esc(p.photo)}" alt="Receipt"></a>`
          : `<span class="no-receipt">—</span>`;
        return `<tr>
          <td>${esc(formatDate(p.date))}</td>
          <td>${esc(p.time || "—")}</td>
          <td class="num">${esc(formatAmount(p))}</td>
          <td>${esc(categoryText(p))}</td>
          <td>${esc(methodCardText(p))}</td>
          <td class="receipt-cell">${thumb}</td>
        </tr>`;
      })
      .join("\n");

    const generated = new Date().toLocaleString();
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(trip.name)} — expenses</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
  .wrap { max-width: 900px; margin: 0 auto; }
  header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
  h1 { font-size: 1.5rem; margin: 0; }
  .meta { color: #64748b; font-size: 0.9rem; }
  .summary { display: flex; gap: 24px; flex-wrap: wrap; margin: 14px 0 20px; }
  .summary div { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; }
  .summary .label { color: #64748b; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .summary .value { font-size: 1.25rem; font-weight: 800; color: #0f766e; }
  .toolbar { margin-bottom: 14px; }
  .btn { font: inherit; padding: 9px 14px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; }
  .btn:hover { background: #f1f5f9; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #eef2f7; font-size: 0.92rem; vertical-align: middle; }
  th { background: #f1f5f9; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
  tr:last-child td { border-bottom: none; }
  td.num { font-variant-numeric: tabular-nums; font-weight: 700; white-space: nowrap; }
  .receipt-cell { width: 72px; }
  .thumb { width: 54px; height: 54px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; cursor: zoom-in; display: block; }
  .no-receipt { color: #94a3b8; }
  .lightbox { position: fixed; inset: 0; background: rgba(15,23,42,0.85); display: none; align-items: center; justify-content: center; padding: 20px; cursor: zoom-out; z-index: 10; }
  .lightbox.open { display: flex; }
  .lightbox img { max-width: 100%; max-height: 100%; border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  @media print { .toolbar { display: none; } body { background: #fff; padding: 0; } .thumb { cursor: default; } }
</style></head>
<body>
  <div class="wrap">
    <header>
      <h1>${esc(trip.name)}</h1>
      <span class="meta">Exported ${esc(generated)}</span>
    </header>
    <div class="summary">
      <div><div class="label">Payments</div><div class="value">${payments.length}</div></div>
      <div><div class="label">Total</div><div class="value">${esc(totalText)}</div></div>
    </div>
    <div class="toolbar"><button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button></div>
    <table>
      <thead><tr>
        <th>Date</th><th>Time</th><th>Amount</th><th>Type</th><th>Card / method</th><th>Receipt</th>
      </tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </div>
  <div class="lightbox" id="lightbox"><img id="lightbox-img" alt="Receipt"></div>
  <script>
    (function () {
      var lb = document.getElementById("lightbox");
      var lbImg = document.getElementById("lightbox-img");
      document.querySelectorAll(".thumb-link").forEach(function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          lbImg.src = a.getAttribute("data-full");
          lb.classList.add("open");
        });
      });
      lb.addEventListener("click", function () { lb.classList.remove("open"); lbImg.src = ""; });
    })();
  <\/script>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    // Open the report for viewing; fall back to a download if the popup is blocked.
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFileName(trip.name) + "-expenses.html";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---- wiring -----------------------------------------------------------
  function init() {
    // Trips.
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

    // Form.
    els.form.addEventListener("submit", submitForm);
    els.resetBtn.addEventListener("click", resetForm);
    els.cancelBtn.addEventListener("click", resetForm);
    els.timeNa.addEventListener("click", () => setTimeNotRelevant(!isTimeNotRelevant()));

    // Number pad — opens whenever the amount field is tapped.
    els.amount.addEventListener("focus", openKeypad);
    els.amount.addEventListener("click", openKeypad);
    els.keypad.addEventListener("click", (e) => {
      const key = e.target.closest(".key");
      if (key) pressKey(key.dataset.key);
    });

    // Method / currency / card.
    $$(".seg").forEach((b) => b.addEventListener("click", () => setMethod(b.dataset.method)));
    $$(".cur").forEach((b) => b.addEventListener("click", () => setCurrency(b.dataset.currency)));
    $$(".card-btn").forEach((b) => b.addEventListener("click", () => setCard(b.dataset.card)));
    $$(".cat").forEach((b) => b.addEventListener("click", () => setCategory(b.dataset.cat)));
    $$(".subcat").forEach((b) => b.addEventListener("click", () => setSubcategory(b.dataset.sub)));

    // Export the current trip.
    els.exportBtn.addEventListener("click", exportTrip);

    // Receipt photo.
    els.photoInput.addEventListener("change", (e) => {
      handlePhoto(e.target.files && e.target.files[0]);
      e.target.value = ""; // allow re-picking the same file
    });
    els.photoRemove.addEventListener("click", () => setStagedPhoto(null));

    // Restore the last active trip (if it still exists).
    const savedActive = localStorage.getItem(LS_ACTIVE);
    const trips = loadTrips();
    activeTripId = trips.some((t) => t.id === savedActive)
      ? savedActive
      : trips.length
      ? trips[0].id
      : null;

    resetForm();
    renderTrips();
    if (activeTripId) renderPayments();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
