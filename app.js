/*
 * Expense Manager — front-end logic.
 *
 * A small, dependency-free app for logging the payments you make while
 * travelling. Everything is stored locally in the browser (localStorage), so
 * it works offline and your data stays on your own device.
 *
 * Inputs so far:
 *   • Date   — defaults to today every time the app is opened.
 *   • Hour   — defaults to the current hour, with a "Not relevant" toggle.
 *   • Method — Cash / Card / Bank transfer.
 *   • Amount — numeric entry with a $ USD / ₪ NIS currency toggle.
 *   • Card   — when "Card" is chosen, pick which card ending (4255 / 6694 / 1921).
 *
 * The form is structured so more inputs can be added as the app grows.
 */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const LS_KEY = "expense-manager.payments";

  // ---- element handles --------------------------------------------------
  const form = $("#expense-form");
  const dateInput = $("#date");
  const timeInput = $("#time");
  const timeNaBtn = $("#time-na");
  const methodDetails = $("#method-details");
  const amountInput = $("#amount");
  const cardPicker = $("#card-picker");
  const formError = $("#form-error");
  const listEl = $("#list");
  const emptyEl = $("#empty");
  const countEl = $("#count");

  // Currency symbols for display.
  const CURRENCY = { USD: "$", ILS: "₪" };

  // Selection state for the button-based inputs.
  const sel = {
    method: null, // "cash" | "card" | "transfer"
    currency: "USD", // "USD" | "ILS"
    card: "4255", // default card ending
  };
  const DEFAULT_CARD = "4255";

  // ---- date / time helpers ---------------------------------------------
  // Local (not UTC) YYYY-MM-DD, so "today" matches the user's own calendar.
  function todayISO(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // Current time as HH:MM for the <input type="time"> default.
  function nowHM(d = new Date()) {
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${min}`;
  }

  // ---- "Not relevant" toggle for the hour ------------------------------
  function setTimeNotRelevant(on) {
    timeNaBtn.setAttribute("aria-pressed", String(on));
    timeNaBtn.classList.toggle("active", on);
    timeInput.disabled = on;
    if (on) {
      timeInput.value = "";
    } else if (!timeInput.value) {
      timeInput.value = nowHM();
    }
  }

  function isTimeNotRelevant() {
    return timeNaBtn.getAttribute("aria-pressed") === "true";
  }

  // ---- payment method (Cash / Card / Bank transfer) --------------------
  function setMethod(method) {
    sel.method = method;
    document.querySelectorAll(".seg").forEach((b) => {
      b.classList.toggle("active", b.dataset.method === method);
    });
    // Reveal the amount entry (numeric keyboard) once a method is picked.
    methodDetails.hidden = false;
    // Card endings only make sense for a card payment.
    const isCard = method === "card";
    cardPicker.hidden = !isCard;
    if (isCard) setCard(sel.card || DEFAULT_CARD);
    // Focusing the amount pops up the numeric keyboard on mobile.
    amountInput.focus();
  }

  // ---- currency ($ USD / ₪ NIS) ----------------------------------------
  function setCurrency(currency) {
    sel.currency = currency;
    document.querySelectorAll(".cur").forEach((b) => {
      const on = b.dataset.currency === currency;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  // ---- card ending ------------------------------------------------------
  function setCard(card) {
    sel.card = card;
    document.querySelectorAll(".card-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.card === card);
    });
  }

  // ---- defaults: run every time the app opens ---------------------------
  function applyDefaults() {
    dateInput.value = todayISO();
    setTimeNotRelevant(false);
    timeInput.value = nowHM();
    sel.method = null;
    document.querySelectorAll(".seg").forEach((b) => b.classList.remove("active"));
    methodDetails.hidden = true;
    cardPicker.hidden = true;
    amountInput.value = "";
    setCurrency("USD");
    setCard(DEFAULT_CARD);
    formError.hidden = true;
  }

  // ---- storage ----------------------------------------------------------
  function loadPayments() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function savePayments(payments) {
    localStorage.setItem(LS_KEY, JSON.stringify(payments));
  }

  // ---- rendering --------------------------------------------------------
  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const METHOD_LABEL = { cash: "💵 Cash", card: "💳 Card", transfer: "🏦 Bank transfer" };

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

  function render() {
    const payments = loadPayments();
    // Newest first: sort by date then time (blank time sorts last within a day).
    payments.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      const ta = a.time || "";
      const tb = b.time || "";
      if (ta !== tb) return ta < tb ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    countEl.textContent = String(payments.length);
    listEl.innerHTML = "";

    if (payments.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    for (const p of payments) {
      const li = document.createElement("li");
      li.className = "item";

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
      metaLine.textContent = `${timeText} · ${methodDescription(p)}`;

      info.append(topLine, metaLine);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "item-del";
      del.setAttribute("aria-label", "Delete payment");
      del.textContent = "✕";
      del.addEventListener("click", () => deletePayment(p.id));

      li.append(info, del);
      listEl.append(li);
    }
  }

  // ---- actions ----------------------------------------------------------
  function addPayment(e) {
    e.preventDefault();
    formError.hidden = true;

    const date = dateInput.value;
    if (!date) {
      formError.textContent = "Please choose a date.";
      formError.hidden = false;
      dateInput.focus();
      return;
    }

    if (!sel.method) {
      formError.textContent = "Please choose a payment method.";
      formError.hidden = false;
      return;
    }

    const amount = parseFloat(amountInput.value);
    if (!(amount > 0)) {
      formError.textContent = "Please enter an amount greater than zero.";
      formError.hidden = false;
      amountInput.focus();
      return;
    }

    const payment = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date,
      time: isTimeNotRelevant() ? "" : timeInput.value || "",
      method: sel.method,
      amount,
      currency: sel.currency,
      card: sel.method === "card" ? sel.card : "",
      createdAt: Date.now(),
    };

    const payments = loadPayments();
    payments.push(payment);
    savePayments(payments);

    render();
    applyDefaults(); // reset the form back to today / current hour
  }

  function deletePayment(id) {
    const payments = loadPayments().filter((p) => p.id !== id);
    savePayments(payments);
    render();
  }

  // ---- wiring -----------------------------------------------------------
  function init() {
    applyDefaults();
    render();

    form.addEventListener("submit", addPayment);
    $("#reset-btn").addEventListener("click", applyDefaults);

    timeNaBtn.addEventListener("click", () => {
      setTimeNotRelevant(!isTimeNotRelevant());
    });

    // Payment-method segmented control.
    document.querySelectorAll(".seg").forEach((b) => {
      b.addEventListener("click", () => setMethod(b.dataset.method));
    });

    // Currency toggle.
    document.querySelectorAll(".cur").forEach((b) => {
      b.addEventListener("click", () => setCurrency(b.dataset.currency));
    });

    // Card-ending buttons.
    document.querySelectorAll(".card-btn").forEach((b) => {
      b.addEventListener("click", () => setCard(b.dataset.card));
    });

    // Keep the amount to digits and a single decimal point.
    amountInput.addEventListener("input", () => {
      let v = amountInput.value.replace(/[^0-9.]/g, "");
      const firstDot = v.indexOf(".");
      if (firstDot !== -1) {
        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
      }
      amountInput.value = v;
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
