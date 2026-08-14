/*
 * Expense Manager — cloud sync (Supabase).
 *
 * Optional, fail-safe layer on top of the local-first app. When the user signs
 * in, trips and payments are synced to Supabase (Postgres + row-level security)
 * so data is backed up and shared across devices. When signed out — or offline,
 * or if Supabase can't be reached — the app behaves exactly as it does locally;
 * nothing here is allowed to break the core experience.
 *
 * Talks to Supabase over its REST/Auth HTTP APIs directly (no SDK), so it stays
 * dependency-free. Auth: email + password. Sync: last-write-wins by updated_at,
 * with an offline outbox and tombstone deletes.
 */
(function () {
  "use strict";

  const SUPABASE_URL = "https://syoyyqaktbvballbxjns.supabase.co";
  const SUPABASE_KEY = "sb_publishable_EFUgpTvrsgmL9u7BIsuuAw_HyGU7NxV";
  const AUTH_URL = SUPABASE_URL + "/auth/v1";
  const REST_URL = SUPABASE_URL + "/rest/v1";

  const LS_SESSION = "expense-manager.session";
  const LS_SYNC = "expense-manager.syncState";
  const LS_OUTBOX = "expense-manager.outbox";

  let session = null; // { access_token, refresh_token, expires_at(ms), user:{id,email} }
  let statusCb = null;
  let renderCb = null;
  let online = typeof navigator !== "undefined" ? navigator.onLine : true;
  let syncing = false;

  function setStatus(s) {
    if (statusCb) try { statusCb(s); } catch (e) {}
  }

  // ---- session persistence ---------------------------------------------
  function loadSession() {
    try { session = JSON.parse(localStorage.getItem(LS_SESSION) || "null"); }
    catch { session = null; }
  }
  function saveSession(s) { session = s; localStorage.setItem(LS_SESSION, JSON.stringify(s)); }
  function clearSession() { session = null; localStorage.removeItem(LS_SESSION); }

  // ---- auth -------------------------------------------------------------
  async function safeFetch(url, opts) {
    try {
      return await fetch(url, opts);
    } catch (e) {
      throw new Error("Couldn't reach the cloud server. Check your internet, and turn off any VPN or ad/tracker blocker (or Brave Shields) for this site, then try again.");
    }
  }

  async function authFetch(path, body) {
    const res = await safeFetch(AUTH_URL + path, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || data.message || ("Auth error " + res.status));
    }
    return data;
  }
  function storeSessionFromResponse(d) {
    if (!d.access_token) {
      throw new Error("No session returned — email confirmation may be required. Disable it in Supabase, or confirm via the email.");
    }
    saveSession({
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: Date.now() + (d.expires_in ? d.expires_in * 1000 : 3600000),
      user: d.user ? { id: d.user.id, email: d.user.email } : session && session.user,
    });
  }
  async function doSignUp(email, password) {
    const d = await authFetch("/signup", { email: email, password: password });
    storeSessionFromResponse(d);
    return session.user;
  }
  async function doSignIn(email, password) {
    const d = await authFetch("/token?grant_type=password", { email: email, password: password });
    storeSessionFromResponse(d);
    return session.user;
  }
  async function refresh() {
    if (!session || !session.refresh_token) throw new Error("no session");
    const d = await authFetch("/token?grant_type=refresh_token", { refresh_token: session.refresh_token });
    storeSessionFromResponse(d);
  }
  async function getToken() {
    if (!session) return null;
    if (Date.now() > session.expires_at - 60000) {
      try { await refresh(); }
      catch (e) { clearSession(); return null; }
    }
    return session.access_token;
  }

  // ---- REST -------------------------------------------------------------
  async function rest(method, path, body, extraHeaders) {
    const token = await getToken();
    if (!token) throw new Error("not signed in");
    const headers = Object.assign(
      { apikey: SUPABASE_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      extraHeaders || {}
    );
    const res = await safeFetch(REST_URL + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("REST " + res.status + " " + t.slice(0, 200));
    }
    if (res.status === 204) return null;
    return res.json().catch(() => null);
  }

  // ---- local <-> remote mapping ----------------------------------------
  function tripToRemote(t) {
    return { id: t.id, name: t.name, created_at: t.createdAt || 0, updated_at: t.updatedAt || t.createdAt || 0, deleted: false };
  }
  function tripFromRemote(r) {
    return { id: r.id, name: r.name, createdAt: Number(r.created_at) || 0, updatedAt: Number(r.updated_at) || 0 };
  }
  function paymentToRemote(p) {
    return {
      id: p.id, trip_id: p.tripId, date: p.date, time: p.time || "", location: p.location || "",
      method: p.method, amount: p.amount, currency: p.currency, card: p.card || "",
      category: p.category, subcategory: p.subcategory || "", thumb: p.thumb || "", has_photo: !!p.hasPhoto,
      created_at: p.createdAt || 0, updated_at: p.updatedAt || p.createdAt || 0, deleted: false,
    };
  }
  function paymentFromRemote(r) {
    return {
      id: r.id, tripId: r.trip_id, date: r.date, time: r.time || "", location: r.location || "",
      method: r.method, amount: Number(r.amount), currency: r.currency, card: r.card || "",
      category: r.category, subcategory: r.subcategory || "", thumb: r.thumb || "", hasPhoto: !!r.has_photo,
      createdAt: Number(r.created_at) || 0, updatedAt: Number(r.updated_at) || 0,
    };
  }

  // ---- outbox (offline queue) ------------------------------------------
  function emptyOutbox() { return { up: { trips: [], payments: [] }, del: { trips: {}, payments: {} } }; }
  function loadOutbox() {
    try { return Object.assign(emptyOutbox(), JSON.parse(localStorage.getItem(LS_OUTBOX)) || {}); }
    catch { return emptyOutbox(); }
  }
  function saveOutbox(o) { localStorage.setItem(LS_OUTBOX, JSON.stringify(o)); }
  function queueUpsert(table, id) {
    const o = loadOutbox();
    if (!o.up[table].includes(id)) o.up[table].push(id);
    delete o.del[table][id];
    saveOutbox(o);
  }
  function queueDelete(table, id) {
    const o = loadOutbox();
    o.up[table] = o.up[table].filter((x) => x !== id);
    o.del[table][id] = Date.now();
    saveOutbox(o);
  }

  // ---- sync state -------------------------------------------------------
  function loadSyncState() {
    try { return Object.assign({ trips: 0, payments: 0 }, JSON.parse(localStorage.getItem(LS_SYNC)) || {}); }
    catch { return { trips: 0, payments: 0 }; }
  }
  function saveSyncState(s) { localStorage.setItem(LS_SYNC, JSON.stringify(s)); }

  // ---- push / pull ------------------------------------------------------
  let pushing = false;
  async function pushOutbox() {
    if (pushing) return;
    pushing = true;
    try {
      await pushOutboxInner();
    } finally {
      pushing = false;
    }
  }
  async function pushOutboxInner() {
    const o = loadOutbox();
    for (const table of ["trips", "payments"]) {
      const ids = o.up[table].slice();
      if (ids.length) {
        const source = table === "trips" ? Store.trips : Store.payments;
        const rows = ids
          .map((id) => {
            const local = source.find((x) => x.id === id);
            if (!local) return null;
            return table === "trips" ? tripToRemote(local) : paymentToRemote(local);
          })
          .filter(Boolean);
        if (rows.length) {
          await rest("POST", "/" + table + "?on_conflict=id", rows, { Prefer: "resolution=merge-duplicates,return=minimal" });
        }
        const o2 = loadOutbox();
        o2.up[table] = o2.up[table].filter((id) => !ids.includes(id));
        saveOutbox(o2);
      }
    }
    for (const table of ["trips", "payments"]) {
      const dels = Object.assign({}, o.del[table]);
      const ids = Object.keys(dels);
      if (ids.length) {
        const rows = ids.map((id) => ({ id: id, updated_at: dels[id], deleted: true }));
        await rest("POST", "/" + table + "?on_conflict=id", rows, { Prefer: "resolution=merge-duplicates,return=minimal" });
        const o2 = loadOutbox();
        ids.forEach((id) => delete o2.del[table][id]);
        saveOutbox(o2);
      }
    }
  }

  async function pull() {
    const sync = loadSyncState();
    for (const table of ["trips", "payments"]) {
      const since = sync[table] || 0;
      const rows = await rest(
        "GET",
        "/" + table + "?select=*&updated_at=gt." + since + "&order=updated_at.asc"
      );
      let maxTs = since;
      for (const r of rows || []) {
        maxTs = Math.max(maxTs, Number(r.updated_at) || 0);
        if (r.deleted) {
          await Store.applyRemoteDelete(table, r.id);
        } else {
          const local = (table === "trips" ? Store.trips : Store.payments).find((x) => x.id === r.id);
          const mapped = table === "trips" ? tripFromRemote(r) : paymentFromRemote(r);
          if (!local || mapped.updatedAt > (local.updatedAt || 0)) {
            await Store.applyRemoteUpsert(table, mapped);
          }
        }
      }
      sync[table] = maxTs;
    }
    saveSyncState(sync);
  }

  // On the first sync for this device/account, queue all existing local rows
  // so data created before signing in gets uploaded.
  function seedOutboxIfFirstSync() {
    const sync = loadSyncState();
    if (sync.trips === 0 && sync.payments === 0) {
      const o = loadOutbox();
      for (const t of Store.trips) if (!o.up.trips.includes(t.id)) o.up.trips.push(t.id);
      for (const p of Store.payments) if (!o.up.payments.includes(p.id)) o.up.payments.push(p.id);
      saveOutbox(o);
    }
  }

  async function fullSync() {
    if (!session) { setStatus("Not signed in"); return; }
    if (!online) { setStatus("Offline — will sync when back online"); return; }
    if (syncing) return;
    syncing = true;
    setStatus("Syncing…");
    try {
      seedOutboxIfFirstSync();
      // Pull first so newer cloud data wins, then push local changes.
      await pull();
      await pushOutbox();
      setStatus("Synced ✓  ·  " + (session.user ? session.user.email : ""));
      if (renderCb) renderCb();
    } catch (e) {
      setStatus("Sync error: " + (e && e.message ? e.message : e));
    } finally {
      syncing = false;
    }
  }

  // ---- local change hook (from Store) ----------------------------------
  function onLocalChange(op, table, id) {
    if (op === "upsert") queueUpsert(table, id);
    else if (op === "delete") queueDelete(table, id);
    if (session && online) pushOutbox().catch(() => {});
  }

  // ---- public API -------------------------------------------------------
  const Cloud = {
    init(opts) {
      opts = opts || {};
      statusCb = opts.onStatus || null;
      renderCb = opts.onRender || null;
      loadSession();
      if (window.Store && Store.setChangeHandler) Store.setChangeHandler(onLocalChange);
      if (typeof window !== "undefined") {
        window.addEventListener("online", () => { online = true; fullSync(); });
        window.addEventListener("offline", () => { online = false; setStatus("Offline"); });
      }
      if (session) {
        setStatus("Signed in as " + (session.user && session.user.email));
        fullSync();
      } else {
        setStatus("Not signed in");
      }
    },
    isSignedIn() { return !!session; },
    currentEmail() { return session && session.user ? session.user.email : ""; },
    async signIn(email, password) {
      const u = await doSignIn(email, password);
      setStatus("Signed in as " + u.email);
      await fullSync();
      return u;
    },
    async signUp(email, password) {
      const u = await doSignUp(email, password);
      setStatus("Account created — " + (u && u.email ? u.email : ""));
      await fullSync();
      return u;
    },
    async signOut() {
      clearSession();
      saveSyncState({ trips: 0, payments: 0 });
      saveOutbox(emptyOutbox());
      setStatus("Signed out");
    },
    sync() { return fullSync(); },
  };

  window.Cloud = Cloud;
})();
