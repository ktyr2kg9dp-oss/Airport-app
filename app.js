/*
 * BD Scout — front-end
 * ------------------------------------------------------------------
 * Gathers the interest text + country, calls the backend, and renders
 * two result blocks: active competitions and companies/startups.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let META = null;

  /* ---------------- Boot: load pickers ---------------- */
  async function boot() {
    try {
      META = await (await fetch("/api/meta")).json();
    } catch (e) {
      // Fall back to bundled data if the meta endpoint is unreachable.
      META = fallbackMeta();
    }
    buildCountry();
    buildTypes();
    $("searchBtn").addEventListener("click", run);
    $("interest").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    $("interest").addEventListener("input", updateChips);

    // Shareable / bookmarkable searches: /?q=drones&country=NATO auto-runs.
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q) {
      $("interest").value = q;
      const country = params.get("country");
      if (country && [...$("country").options].some((o) => o.value === country)) {
        $("country").value = country;
      }
      updateChips();
      run();
    }
  }

  function fallbackMeta() {
    const D = window.BD_DATA || {};
    return {
      countries: (D.COUNTRIES || []).map((c) => ({ code: c.code, name: c.name, flag: c.flag, nato: !!c.nato })),
      noticeTypes: D.NOTICE_TYPES || [],
      domains: Object.entries(D.DOMAINS || {}).map(([k, d]) => ({ key: k, label: d.label })),
      liveSam: false, liveCompanies: false,
    };
  }

  function buildCountry() {
    const sel = $("country");
    sel.innerHTML = "";
    META.countries.forEach((c) => {
      const o = el("option");
      o.value = c.code;
      o.textContent = `${c.flag || ""} ${c.name}`.trim();
      sel.appendChild(o);
    });
    const any = el("option");
    any.value = "ANY"; any.textContent = "🌍 Any / global";
    sel.appendChild(any);
  }

  function buildTypes() {
    const box = $("types");
    box.innerHTML = "";
    META.noticeTypes.forEach((t) => {
      const id = `t_${t.code}`;
      const wrap = el("label", "type");
      wrap.innerHTML =
        `<input type="checkbox" id="${id}" value="${t.code}" ${t.on ? "checked" : ""}/>` +
        `<span><b>${esc(t.label)}</b><small>${esc(t.desc)}</small></span>`;
      box.appendChild(wrap);
    });
  }

  /* Live preview of which technology domains the text matches. */
  function updateChips() {
    const D = window.BD_DATA;
    const box = $("chips");
    box.innerHTML = "";
    if (!D) return;
    const hits = D.detectDomains($("interest").value);
    hits.forEach((k) => {
      const c = el("span", "chip", esc(D.DOMAINS[k].label));
      box.appendChild(c);
    });
  }

  function selectedTypes() {
    return [...document.querySelectorAll("#types input:checked")].map((i) => i.value);
  }

  /* ---------------- Run a search ---------------- */
  async function run() {
    const interest = $("interest").value.trim();
    const country = $("country").value;
    if (!interest) {
      setStatus("Type an interest area first (e.g. drones).", true);
      $("interest").focus();
      return;
    }
    setStatus("Searching competitions and companies…");
    $("searchBtn").disabled = true;

    // Keep the URL shareable.
    const share = new URLSearchParams({ q: interest, country });
    history.replaceState(null, "", `?${share.toString()}`);

    const types = selectedTypes().join(",");
    const oppUrl = `/api/opportunities?interest=${encodeURIComponent(interest)}&country=${country}&types=${types}`;
    const coUrl = `/api/companies?interest=${encodeURIComponent(interest)}&country=${country}`;

    try {
      const [opp, co] = await Promise.all([
        fetch(oppUrl).then((r) => r.json()),
        fetch(coUrl).then((r) => r.json()),
      ]);
      renderOpps(opp);
      renderCompanies(co);
      $("results").hidden = false;
      setStatus("");
    } catch (e) {
      setStatus(`Search failed: ${e.message}`, true);
    } finally {
      $("searchBtn").disabled = false;
    }
  }

  /* ---------------- Render: competitions ---------------- */
  function renderOpps(d) {
    const badge = $("oppBadge");
    if (d.live) { badge.textContent = `LIVE · ${d.source}`; badge.className = "badge live"; }
    else { badge.textContent = "SAMPLE"; badge.className = "badge sample"; }

    $("oppNote").textContent = d.note || "";

    const portals = $("portals");
    portals.innerHTML = "";
    (d.portals || []).forEach((p) => {
      const a = el("a", "portal");
      a.href = p.url; a.target = "_blank"; a.rel = "noopener";
      a.innerHTML = `🔗 ${esc(p.name)}`;
      portals.appendChild(a);
    });

    const box = $("opps");
    box.innerHTML = "";
    const list = d.opportunities || [];
    if (!list.length) {
      box.appendChild(el("p", "empty", "No notices to show — use the portal links above for live results."));
      return;
    }
    list.forEach((o) => {
      const card = el("div", "card opp");
      const tag = o.sample ? `<span class="pill sample">sample</span>` : (o.active ? `<span class="pill live">active</span>` : "");
      const meta = [o.agency, o.type].filter(Boolean).map(esc).join(" · ");
      const bits = [];
      if (o.deadline) bits.push(`⏳ Response: ${esc(o.deadline)}`);
      if (o.solNum && o.solNum !== "SAMPLE") bits.push(`# ${esc(o.solNum)}`);
      if (o.naics) bits.push(`NAICS ${esc(o.naics)}`);
      if (o.setAside) bits.push(`🏷️ ${esc(o.setAside)}`);
      card.innerHTML =
        `<div class="card-top"><h3>${esc(o.title)}</h3>${tag}</div>` +
        `<p class="card-meta">${meta}</p>` +
        (bits.length ? `<p class="card-bits">${bits.join(" &nbsp;·&nbsp; ")}</p>` : "");
      if (o.url) {
        const a = el("a", "card-link");
        a.href = o.url; a.target = "_blank"; a.rel = "noopener";
        a.textContent = "View notice →";
        card.appendChild(a);
      }
      box.appendChild(card);
    });
  }

  /* ---------------- Render: companies ---------------- */
  function renderCompanies(d) {
    const list = d.curated || [];
    const badge = $("coBadge");
    badge.textContent = `${list.length} found`;
    badge.className = "badge count";

    const dm = (d.domains || []).length ? `Matched: ${d.domains.map(esc).join(", ")}. ` : "";
    $("coNote").textContent = dm + (d.webNote || "");

    const box = $("companies");
    box.innerHTML = "";
    if (!list.length) {
      box.appendChild(el("p", "empty",
        "No curated matches for that country + interest. Try “Any / global”, a broader term, or the Google link below."));
    }
    const interest = d.interest || "";
    list.forEach((c) => {
      const card = el("div", "card company");
      const cls = c.type === "Startup" ? "startup" : c.type === "SME" ? "sme" : "prime";
      const photoQuery = `${c.name} ${interest}`.trim();
      card.innerHTML =
        `<div class="card-top"><h3>${esc(c.name)}</h3><span class="pill ${cls}">${esc(c.type)}</span></div>` +
        `<p class="card-meta">${esc(c.country)}</p>` +
        `<p class="card-focus">${esc(c.focus)}</p>` +
        `<div class="photos" aria-label="Product photos"></div>`;
      const links = el("div", "card-links");
      if (c.url) {
        const a = el("a", "card-link");
        a.href = c.url; a.target = "_blank"; a.rel = "noopener";
        a.textContent = "Website →";
        links.appendChild(a);
      }
      const ph = el("a", "card-link photo-link");
      ph.href = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(photoQuery)}`;
      ph.target = "_blank"; ph.rel = "noopener";
      ph.textContent = "📷 Photos →";
      links.appendChild(ph);
      card.appendChild(links);
      box.appendChild(card);

      // Try to load 2 inline product thumbnails (needs SERPAPI_KEY on server).
      loadPhotos(card.querySelector(".photos"), photoQuery);
    });

    // Live web results (when SERPAPI_KEY is set on the server).
    const web = $("web");
    web.innerHTML = "";
    if ((d.web || []).length) {
      web.appendChild(el("h4", "web-head", "More from the web"));
      d.web.forEach((w) => {
        const a = el("a", "webitem");
        a.href = w.url; a.target = "_blank"; a.rel = "noopener";
        a.innerHTML = `<b>${esc(w.title)}</b><small>${esc(w.source)}</small><span>${esc(w.snippet)}</span>`;
        web.appendChild(a);
      });
    }

    const link = $("searchLink");
    if (d.searchLink) { link.href = d.searchLink; link.hidden = false; }
    else link.hidden = true;
  }

  /* Show a picture if one is available, otherwise leave the "📷 Photos" link.
   * Fetches up to 2 product thumbnails; on success the fallback link is
   * hidden so each card shows a picture OR a link, never both. */
  async function loadPhotos(container, query) {
    if (!container || !query) return;
    try {
      const r = await fetch(`/api/images?q=${encodeURIComponent(query)}`);
      const d = await r.json();
      if (!d.ok || !d.images || !d.images.length) return; // keep the link
      d.images.slice(0, 2).forEach((im) => {
        const a = el("a", "thumb");
        a.href = im.link || im.thumb; a.target = "_blank"; a.rel = "noopener";
        const img = el("img");
        img.src = im.thumb; img.loading = "lazy"; img.alt = query;
        a.appendChild(img);
        container.appendChild(a);
      });
      // A picture is showing — drop the redundant "Photos" link.
      const card = container.closest(".card");
      const link = card && card.querySelector(".photo-link");
      if (link) link.remove();
    } catch (e) { /* leave the Photos link as the fallback */ }
  }

  function setStatus(msg, isError) {
    const s = $("status");
    s.textContent = msg || "";
    s.className = "status" + (isError ? " error" : "");
  }

  boot();
})();
