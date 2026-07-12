/*
 * Cup-Les — front-end logic.
 *
 * Handles role selection, connects a Server-Sent Events stream keyed by the
 * couple's pair code, sends the chosen phrase on each button tap, and renders
 * whatever the partner sends back.
 *
 * If it can't reach a server (e.g. the file was opened directly as file://),
 * it falls back to a BroadcastChannel so two tabs in the SAME browser can
 * still talk — handy for a quick demo.
 */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const state = {
    role: null, // "husband" | "wife"
    pair: "",
    source: null, // EventSource
    channel: null, // BroadcastChannel fallback
    partnerOnline: false,
  };

  const LS_KEY = "cuples.session";

  // ---- helpers ----------------------------------------------------------
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function partnerOf(role) {
    return role === "husband" ? "wife" : "husband";
  }
  function sanitizePair(code) {
    return String(code || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $("#" + id).classList.add("active");
  }

  // ---- start / stop a session ------------------------------------------
  function startSession(role, pair) {
    state.role = role;
    state.pair = pair;
    localStorage.setItem(LS_KEY, JSON.stringify({ role, pair }));
    showScreen(role === "wife" ? "screen-wife" : "screen-husband");
    connect();
  }

  function leaveSession() {
    if (state.source) { state.source.close(); state.source = null; }
    if (state.channel) { state.channel.close(); state.channel = null; }
    state.role = null;
    state.partnerOnline = false;
    localStorage.removeItem(LS_KEY);
    showScreen("screen-setup");
  }

  // ---- connectivity -----------------------------------------------------
  function connect() {
    setPresence(false, "Connecting…");
    // Prefer the real-time server stream.
    try {
      const url = `/events?pair=${encodeURIComponent(state.pair)}&role=${state.role}`;
      const es = new EventSource(url);
      state.source = es;

      es.addEventListener("message", (e) => onMessage(JSON.parse(e.data)));
      es.addEventListener("presence", (e) => {
        const { partnerOnline } = JSON.parse(e.data);
        if (partnerOnline) state.partnerOnline = true;
        else state.partnerOnline = false;
        setPresence(state.partnerOnline);
      });
      es.addEventListener("open", () => setPresence(state.partnerOnline));
      es.addEventListener("error", () => {
        // Server not reachable (or stream dropped). Fall back to local demo.
        if (es.readyState === EventSource.CLOSED) {
          es.close();
          state.source = null;
          startLocalFallback();
        }
      });
    } catch (err) {
      startLocalFallback();
    }
  }

  // Same-browser fallback so two tabs can demo without a server.
  function startLocalFallback() {
    if (!("BroadcastChannel" in window)) {
      setPresence(false, "Offline — start the server to connect");
      return;
    }
    const ch = new BroadcastChannel("cuples:" + state.pair);
    state.channel = ch;
    ch.onmessage = (e) => {
      const data = e.data || {};
      if (data.type === "hello" && data.role === partnerOf(state.role)) {
        state.partnerOnline = true;
        setPresence(true);
        ch.postMessage({ type: "hi", role: state.role });
      } else if (data.type === "hi" && data.role === partnerOf(state.role)) {
        state.partnerOnline = true;
        setPresence(true);
      } else if (data.type === "message" && data.to === state.role) {
        onMessage(data.payload);
      }
    };
    ch.postMessage({ type: "hello", role: state.role });
    setPresence(false, "Same-device mode");
  }

  function setPresence(online, labelOverride) {
    const suffix = state.role === "wife" ? "wife" : "husband";
    const dot = $("#dot-" + suffix);
    const label = $("#presence-" + suffix);
    if (!dot || !label) return;
    dot.classList.toggle("online", !!online);
    const partner = partnerOf(state.role) === "husband" ? "Husband" : "Wife";
    label.textContent = labelOverride || (online ? `${partner} is online` : `Waiting for ${partner.toLowerCase()}…`);
  }

  // ---- sending ----------------------------------------------------------
  function sendPhrase(kind) {
    const phrase = pick(PHRASES[kind]);
    const payload = { kind, text: phrase, from: state.role, at: Date.now() };

    // Optimistic local echo in the sender's own feed.
    localEcho(kind, phrase);
    flashToast(`Sent: “${phrase}”`);

    // Try the server first.
    fetch("/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair: state.pair, from: state.role, kind, text: phrase }),
    }).catch(() => {
      // If the server isn't there, relay via the local channel instead.
      if (state.channel) {
        state.channel.postMessage({ type: "message", to: partnerOf(state.role), payload });
      }
    });

    // Belt & suspenders: if we're already in local mode, also relay now.
    if (state.channel) {
      state.channel.postMessage({ type: "message", to: partnerOf(state.role), payload });
    }
  }

  // ---- receiving --------------------------------------------------------
  function onMessage(payload) {
    const kind = KINDS[payload.kind] ? payload.kind : "bow";
    const meta = KINDS[kind];
    addFeedItem(state.role, {
      dir: "in",
      tone: meta.tone,
      title: meta.title,
      text: payload.text,
      at: payload.at || Date.now(),
    });
    showBanner(meta.title, payload.text, meta.tone);
    vibrate(kind);
  }

  function localEcho(kind, text) {
    const meta = KINDS[kind] || { title: "Sent", tone: "sent" };
    addFeedItem(state.role, {
      dir: "out",
      tone: meta.tone,
      title: "You sent",
      text,
      at: Date.now(),
    });
  }

  function addFeedItem(role, item) {
    const feed = $("#feed-" + (role === "wife" ? "wife" : "husband"));
    if (!feed) return;
    const li = document.createElement("li");
    li.className = `feed-item ${item.dir} tone-${item.tone}`;
    const time = new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    li.innerHTML =
      `<div class="feed-head"><span class="feed-kind"></span><span class="feed-time"></span></div>` +
      `<div class="feed-body"></div>`;
    li.querySelector(".feed-kind").textContent = item.title;
    li.querySelector(".feed-time").textContent = time;
    li.querySelector(".feed-body").textContent = item.text;
    feed.prepend(li);
    while (feed.children.length > 40) feed.removeChild(feed.lastChild);
  }

  // ---- little bits of feedback -----------------------------------------
  let bannerTimer = null;
  function showBanner(title, text, tone) {
    const banner = $("#banner");
    $("#banner-title").textContent = title;
    $("#banner-text").textContent = text;
    banner.className = "banner tone-" + tone;
    banner.hidden = false;
    // force reflow so the transition replays
    void banner.offsetWidth;
    banner.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      banner.classList.remove("show");
      setTimeout(() => (banner.hidden = true), 350);
    }, 5000);
  }

  let toastTimer = null;
  function flashToast(msg) {
    const el = $("#toast-" + (state.role === "wife" ? "wife" : "husband"));
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => (el.hidden = true), 300);
    }, 2500);
  }

  function vibrate(kind) {
    if (!navigator.vibrate) return;
    const patterns = { mad: [120, 60, 120], bad: [80], cucumber: [40, 40, 40, 40], bow: [200] };
    navigator.vibrate(patterns[kind] || [80]);
  }

  // ---- wiring -----------------------------------------------------------
  function init() {
    // Role selection buttons.
    document.querySelectorAll(".role-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pair = sanitizePair($("#pair-code").value);
        const err = $("#setup-error");
        if (!pair) {
          err.textContent = "Please enter a pair code first (letters or numbers).";
          err.hidden = false;
          $("#pair-code").focus();
          return;
        }
        err.hidden = true;
        startSession(btn.dataset.role, pair);
      });
    });

    // Action buttons on both screens.
    document.querySelectorAll("[data-send]").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.classList.remove("tapped");
        void btn.offsetWidth;
        btn.classList.add("tapped");
        sendPhrase(btn.dataset.send);
      });
    });

    // Back / change buttons.
    document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", leaveSession));

    // Resume a previous session on reload.
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (saved && saved.role && saved.pair) {
        $("#pair-code").value = saved.pair;
        startSession(saved.role, saved.pair);
      }
    } catch {
      /* ignore */
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
