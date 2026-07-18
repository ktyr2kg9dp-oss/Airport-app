/*
 * Expense Manager — persistence layer.
 *
 * Uses IndexedDB when available (durable, handles many receipt photos), and
 * falls back to an in-memory store when it isn't (e.g. a locked-down sandbox).
 *
 * Trips and payment *metadata* — including a light thumbnail — are kept in an
 * in-memory cache so the UI can render synchronously. Full-resolution receipt
 * images live in a separate object store and are fetched on demand (for export).
 *
 * Data created by the previous localStorage-only version is migrated in once.
 */
(function () {
  "use strict";

  const DB_NAME = "expense-manager";
  const DB_VERSION = 1;
  const LS_TRIPS = "expense-manager.trips";
  const LS_PAYMENTS = "expense-manager.payments";
  const LS_ACTIVE = "expense-manager.activeTrip";

  let db = null;
  let memoryMode = false;

  const cache = { trips: [], payments: [], activeTripId: null, settings: {} };
  const memPhotos = {}; // paymentId -> full data URL (memory fallback)

  // Notifies the cloud layer of local changes (set via setChangeHandler).
  let changeHandler = null;
  function fireChange(op, table, id) {
    if (changeHandler) {
      try { changeHandler(op, table, id); } catch (e) {}
    }
  }

  function openDB() {
    return new Promise((resolve) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        return resolve(null);
      }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("trips")) d.createObjectStore("trips", { keyPath: "id" });
        if (!d.objectStoreNames.contains("payments")) d.createObjectStore("payments", { keyPath: "id" });
        if (!d.objectStoreNames.contains("photos")) d.createObjectStore("photos", { keyPath: "id" });
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "k" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }

  function reqP(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  const getAll = (s) => reqP(db.transaction(s, "readonly").objectStore(s).getAll());
  const getOne = (s, k) => reqP(db.transaction(s, "readonly").objectStore(s).get(k));
  const put = (s, v) => reqP(db.transaction(s, "readwrite").objectStore(s).put(v));
  const del = (s, k) => reqP(db.transaction(s, "readwrite").objectStore(s).delete(k));

  function readLS(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  // Split an old single-photo payment into { meta (with thumb), full }.
  function splitLegacy(p) {
    const meta = Object.assign({}, p);
    const photo = meta.photo || "";
    delete meta.photo;
    meta.thumb = photo;
    meta.hasPhoto = !!photo;
    return { meta, full: photo };
  }

  async function migrateFromLocalStorage() {
    const trips = readLS(LS_TRIPS);
    const payments = readLS(LS_PAYMENTS);
    const active = localStorage.getItem(LS_ACTIVE);
    if (!Array.isArray(trips) && !Array.isArray(payments)) return;

    if (Array.isArray(trips)) for (const t of trips) await put("trips", t);
    if (Array.isArray(payments)) {
      for (const p of payments) {
        const { meta, full } = splitLegacy(p);
        await put("payments", meta);
        if (full) await put("photos", { id: p.id, full });
      }
    }
    if (active) await put("meta", { k: "activeTripId", v: active });

    localStorage.removeItem(LS_TRIPS);
    localStorage.removeItem(LS_PAYMENTS);
    localStorage.removeItem(LS_ACTIVE);
  }

  const Store = {
    get memoryMode() { return memoryMode; },
    get trips() { return cache.trips; },
    get payments() { return cache.payments; },
    get activeTripId() { return cache.activeTripId; },

    async init() {
      db = await openDB();
      if (!db) {
        memoryMode = true;
        // Best-effort read of any existing data (kept in memory only).
        const trips = readLS(LS_TRIPS);
        const payments = readLS(LS_PAYMENTS);
        if (Array.isArray(trips)) cache.trips = trips;
        if (Array.isArray(payments)) {
          cache.payments = payments.map((p) => {
            const { meta, full } = splitLegacy(p);
            if (full) memPhotos[p.id] = full;
            return meta;
          });
        }
        cache.activeTripId = localStorage.getItem(LS_ACTIVE) || null;
        return;
      }
      await migrateFromLocalStorage();
      cache.trips = await getAll("trips");
      cache.payments = await getAll("payments");
      const m = await getOne("meta", "activeTripId");
      cache.activeTripId = m ? m.v : null;
      const s = await getOne("meta", "settings");
      cache.settings = s && s.v ? s.v : {};
    },

    get settings() {
      return cache.settings;
    },
    getSetting(key, fallback) {
      return key in cache.settings ? cache.settings[key] : fallback;
    },
    async setSetting(key, value) {
      cache.settings[key] = value;
      if (!memoryMode) await put("meta", { k: "settings", v: cache.settings });
    },

    async setActiveTrip(id) {
      cache.activeTripId = id;
      if (!memoryMode) await put("meta", { k: "activeTripId", v: id || "" });
    },

    async saveTrip(trip) {
      const i = cache.trips.findIndex((t) => t.id === trip.id);
      if (i === -1) cache.trips.push(trip);
      else cache.trips[i] = trip;
      if (!memoryMode) await put("trips", trip);
      fireChange("upsert", "trips", trip.id);
    },

    async deleteTrip(id) {
      cache.trips = cache.trips.filter((t) => t.id !== id);
      const removed = cache.payments.filter((p) => p.tripId === id).map((p) => p.id);
      cache.payments = cache.payments.filter((p) => p.tripId !== id);
      if (!memoryMode) {
        await del("trips", id);
        for (const pid of removed) {
          await del("payments", pid);
          await del("photos", pid);
        }
      } else {
        removed.forEach((pid) => delete memPhotos[pid]);
      }
      fireChange("delete", "trips", id);
      removed.forEach((pid) => fireChange("delete", "payments", pid));
    },

    // `full`: undefined = leave photo as-is; null = remove; string = write.
    async savePayment(meta, full) {
      const i = cache.payments.findIndex((p) => p.id === meta.id);
      if (i === -1) cache.payments.push(meta);
      else cache.payments[i] = meta;
      if (memoryMode) {
        if (full === null) delete memPhotos[meta.id];
        else if (typeof full === "string") memPhotos[meta.id] = full;
        return;
      }
      await put("payments", meta);
      if (full === null) await del("photos", meta.id);
      else if (typeof full === "string") await put("photos", { id: meta.id, full });
    },

    async deletePayment(id) {
      cache.payments = cache.payments.filter((p) => p.id !== id);
      if (memoryMode) {
        delete memPhotos[id];
      } else {
        await del("payments", id);
        await del("photos", id);
      }
      fireChange("delete", "payments", id);
    },

    async getPhoto(paymentId) {
      if (memoryMode) return memPhotos[paymentId] || null;
      const rec = await getOne("photos", paymentId);
      return rec ? rec.full : null;
    },

    // ---- cloud sync hooks (applied silently — no change events) ----------
    setChangeHandler(fn) {
      changeHandler = fn;
    },
    async applyRemoteUpsert(table, row) {
      if (table === "trips") {
        const i = cache.trips.findIndex((t) => t.id === row.id);
        const merged = i === -1 ? row : Object.assign({}, cache.trips[i], row);
        if (i === -1) cache.trips.push(merged);
        else cache.trips[i] = merged;
        if (!memoryMode) await put("trips", merged);
      } else {
        const i = cache.payments.findIndex((p) => p.id === row.id);
        const merged = i === -1 ? row : Object.assign({}, cache.payments[i], row);
        if (i === -1) cache.payments.push(merged);
        else cache.payments[i] = merged;
        if (!memoryMode) await put("payments", merged);
      }
    },
    async applyRemoteDelete(table, id) {
      if (table === "trips") {
        cache.trips = cache.trips.filter((t) => t.id !== id);
        const removed = cache.payments.filter((p) => p.tripId === id).map((p) => p.id);
        cache.payments = cache.payments.filter((p) => p.tripId !== id);
        if (!memoryMode) {
          await del("trips", id);
          for (const pid of removed) {
            await del("payments", pid);
            await del("photos", pid);
          }
        }
        if (cache.activeTripId === id) cache.activeTripId = cache.trips.length ? cache.trips[0].id : null;
      } else {
        cache.payments = cache.payments.filter((p) => p.id !== id);
        if (!memoryMode) {
          await del("payments", id);
          await del("photos", id);
        }
      }
    },
  };

  window.Store = Store;
})();
