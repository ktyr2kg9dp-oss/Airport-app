/*
 * BD App — shared data layer
 * ------------------------------------------------------------------
 * Works in BOTH the browser (sets window.BD_DATA) and Node (module.exports),
 * so the front-end can render the country / notice-type pickers while the
 * server reuses the same company database and matching helpers.
 *
 * Contents:
 *   NOTICE_TYPES  – the kinds of "active competition" we surface (maps to
 *                   SAM.gov `ptype` codes: Sources Sought, RFI, Presol, RFP…)
 *   NATO_MEMBERS  – the 32 NATO member states (for the "NATO" country option)
 *   COUNTRIES     – selectable countries + their official procurement portals
 *   DOMAINS       – interest keywords → canonical technology domains
 *   COMPANIES     – curated primes / SMEs / startups tagged by domain + country
 *   helpers       – detectDomains(), resolveCountries(), searchCompanies()
 */

/* ------------------------------------------------------------------ */
/* Competition / notice types (SAM.gov ptype codes)                   */
/* ------------------------------------------------------------------ */
const NOTICE_TYPES = [
  { code: "r", label: "Sources Sought", desc: "Market research — who can do this?", on: true },
  { code: "i", label: "RFI / Special Notice", desc: "Request for Information", on: true },
  { code: "p", label: "Presolicitation", desc: "A solicitation is coming soon", on: true },
  { code: "o", label: "Solicitation (RFP/RFQ)", desc: "Formal request for proposals", on: true },
  { code: "k", label: "Combined Synopsis / Solicitation", desc: "Synopsis + solicitation in one", on: true },
  { code: "a", label: "Award Notice", desc: "Who won (intel on incumbents)", on: false },
];

/* ------------------------------------------------------------------ */
/* NATO member states (as of 2024, incl. Finland & Sweden)            */
/* ------------------------------------------------------------------ */
const NATO_MEMBERS = [
  "Albania", "Belgium", "Bulgaria", "Canada", "Croatia", "Czechia", "Denmark",
  "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland",
  "Italy", "Latvia", "Lithuania", "Luxembourg", "Montenegro", "Netherlands",
  "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "Slovakia",
  "Slovenia", "Spain", "Sweden", "Türkiye", "United Kingdom", "United States",
];

/* ------------------------------------------------------------------ */
/* Countries + official procurement portals                           */
/* `portal(q)` builds a deep link that pre-fills the search term.      */
/* `nato` marks the special "all NATO members" option.                */
/* ------------------------------------------------------------------ */
const COUNTRIES = [
  {
    code: "US", name: "United States", flag: "🇺🇸", live: true,
    portals: [
      { name: "SAM.gov", url: (q) => `https://sam.gov/search/?index=opp&sort=-modifiedDate&keywords=${encodeURIComponent(q)}` },
      { name: "DIU (Defense Innovation Unit)", url: () => `https://www.diu.mil/work-with-us/submit-solution` },
      { name: "SBIR/STTR", url: (q) => `https://www.sbir.gov/topics?search_api_fulltext=${encodeURIComponent(q)}` },
    ],
  },
  {
    code: "NATO", name: "NATO (all members)", flag: "🛡️", nato: true,
    portals: [
      { name: "NSPA e-Portal", url: () => `https://eportal.nspa.nato.int/` },
      { name: "NCIA — Doing Business", url: () => `https://www.ncia.nato.int/business.html` },
      { name: "NATO ACT — Innovation", url: () => `https://www.act.nato.int/activities/innovation/` },
      { name: "DIANA (Defence Innovation Accelerator)", url: () => `https://www.diana.nato.int/challenges.html` },
    ],
  },
  {
    code: "GB", name: "United Kingdom", flag: "🇬🇧",
    portals: [
      { name: "Find a Tender", url: (q) => `https://www.find-tender.service.gov.uk/Search/Results?Keywords=${encodeURIComponent(q)}` },
      { name: "Contracts Finder", url: (q) => `https://www.contractsfinder.service.gov.uk/Search/Results?&searchTerm=${encodeURIComponent(q)}` },
      { name: "DASA (Def & Sec Accelerator)", url: () => `https://www.gov.uk/government/organisations/defence-and-security-accelerator` },
    ],
  },
  {
    code: "FR", name: "France", flag: "🇫🇷",
    portals: [
      { name: "PLACE (marchés de l'État)", url: () => `https://www.marches-publics.gouv.fr/` },
      { name: "BOAMP", url: (q) => `https://www.boamp.fr/pages/recherche/?disjunctive.type_marche&q=${encodeURIComponent(q)}` },
      { name: "EU TED", url: (q) => tedUrl(q) },
    ],
  },
  {
    code: "DE", name: "Germany", flag: "🇩🇪",
    portals: [
      { name: "service.bund.de", url: (q) => `https://www.service.bund.de/Content/DE/Ausschreibungen/Suche/Formular.html?nn=4641514&resultsPerPage=20&searchtext=${encodeURIComponent(q)}` },
      { name: "EU TED", url: (q) => tedUrl(q) },
    ],
  },
  {
    code: "IT", name: "Italy", flag: "🇮🇹",
    portals: [
      { name: "Acquisti in Rete (Consip)", url: () => `https://www.acquistinretepa.it/` },
      { name: "EU TED", url: (q) => tedUrl(q) },
    ],
  },
  {
    code: "PL", name: "Poland", flag: "🇵🇱",
    portals: [
      { name: "e-Zamówienia", url: () => `https://ezamowienia.gov.pl/` },
      { name: "EU TED", url: (q) => tedUrl(q) },
    ],
  },
  {
    code: "NL", name: "Netherlands", flag: "🇳🇱",
    portals: [
      { name: "TenderNed", url: (q) => `https://www.tenderned.nl/aankondigingen/overzicht?searchString=${encodeURIComponent(q)}` },
      { name: "EU TED", url: (q) => tedUrl(q) },
    ],
  },
  {
    code: "TR", name: "Türkiye", flag: "🇹🇷",
    portals: [
      { name: "EKAP (Kamu İhale)", url: () => `https://ekap.kik.gov.tr/EKAP/` },
      { name: "SSB (Def. Industries)", url: () => `https://www.ssb.gov.tr/` },
    ],
  },
  {
    code: "CA", name: "Canada", flag: "🇨🇦",
    portals: [
      { name: "CanadaBuys", url: (q) => `https://canadabuys.canada.ca/en/tender-opportunities?search_filter=${encodeURIComponent(q)}` },
      { name: "IDEaS (Def. innovation)", url: () => `https://www.canada.ca/en/department-national-defence/programs/defence-ideas.html` },
    ],
  },
  {
    code: "AU", name: "Australia", flag: "🇦🇺",
    portals: [
      { name: "AusTender", url: (q) => `https://www.tenders.gov.au/atm?keyword=${encodeURIComponent(q)}` },
    ],
  },
  {
    code: "SE", name: "Sweden", flag: "🇸🇪",
    portals: [
      { name: "FMV (Defence Materiel)", url: () => `https://www.fmv.se/` },
      { name: "EU TED", url: (q) => tedUrl(q) },
    ],
  },
  {
    code: "NO", name: "Norway", flag: "🇳🇴",
    portals: [
      { name: "Doffin", url: (q) => `https://www.doffin.no/search?searchString=${encodeURIComponent(q)}` },
    ],
  },
  {
    code: "ES", name: "Spain", flag: "🇪🇸",
    portals: [
      { name: "Plataforma de Contratación", url: () => `https://contrataciondelestado.es/` },
      { name: "EU TED", url: (q) => tedUrl(q) },
    ],
  },
];

function tedUrl(q) {
  return `https://ted.europa.eu/en/search/result?scope=ALL&text=${encodeURIComponent(q)}`;
}

/* ------------------------------------------------------------------ */
/* Interest keyword → canonical technology domain                     */
/* ------------------------------------------------------------------ */
const DOMAINS = {
  uas: {
    label: "Uncrewed Aerial Systems (drones / UAV)",
    synonyms: ["drone", "drones", "uav", "uas", "unmanned aerial", "uncrewed aerial",
      "quadcopter", "multirotor", "fpv", "loitering", "loitering munition", "suas",
      "fixed-wing drone", "vtol drone", "reconnaissance drone", "isr drone", "kamikaze drone"],
  },
  cuas: {
    label: "Counter-UAS (anti-drone)",
    synonyms: ["counter-uas", "counter uas", "c-uas", "cuas", "counter-drone", "counter drone",
      "anti-drone", "anti drone", "drone defence", "drone defense", "drone detection", "rf jamming"],
  },
  helicopter: {
    label: "Helicopters & Rotorcraft",
    synonyms: ["helicopter", "helicopters", "rotorcraft", "rotary", "rotary-wing", "rotary wing",
      "tiltrotor", "attack helicopter", "utility helicopter"],
  },
  evtol: {
    label: "eVTOL / Advanced Air Mobility",
    synonyms: ["evtol", "vtol aircraft", "air taxi", "advanced air mobility", "aam", "urban air mobility"],
  },
  missiles: {
    label: "Missiles & Munitions",
    synonyms: ["missile", "missiles", "munition", "munitions", "rocket", "guided weapon", "hypersonic"],
  },
  ew: {
    label: "Electronic Warfare & Sensors",
    synonyms: ["electronic warfare", "ew", "radar", "sensor", "signals intelligence", "sigint", "jamming"],
  },
  ai: {
    label: "Defense AI / Autonomy",
    synonyms: ["artificial intelligence", "ai", "autonomy", "autonomous", "machine learning",
      "computer vision", "battlefield ai", "targeting ai"],
  },
  space: {
    label: "Space & Satellites",
    synonyms: ["space", "satellite", "satellites", "launch", "smallsat", "space situational"],
  },
  maritime: {
    label: "Maritime & Uncrewed Surface/Sub Vessels",
    synonyms: ["maritime", "usv", "uuv", "unmanned surface", "unmanned underwater", "naval drone", "sub-sea"],
  },
  ground: {
    label: "Uncrewed Ground Vehicles & Robotics",
    synonyms: ["ugv", "ground robot", "unmanned ground", "robotic vehicle", "quadruped", "ground robotics"],
  },
};

/* ------------------------------------------------------------------ */
/* Company database — primes, SMEs and startups by domain + country.   */
/* Curated & illustrative; verify status before outreach.              */
/* ------------------------------------------------------------------ */
const COMPANIES = [
  /* ---- United States: UAS / drones ---- */
  { name: "AeroVironment", country: "United States", type: "Prime", domains: ["uas", "cuas"], focus: "Switchblade loitering munitions, Puma & small ISR UAS.", url: "https://www.avinc.com" },
  { name: "General Atomics ASI", country: "United States", type: "Prime", domains: ["uas"], focus: "MQ-9 Reaper, MQ-1C Gray Eagle MALE UAS.", url: "https://www.ga-asi.com" },
  { name: "Anduril Industries", country: "United States", type: "Startup", domains: ["uas", "cuas", "ai"], focus: "Ghost & Altius UAS, Lattice autonomy, Anvil interceptors.", url: "https://www.anduril.com" },
  { name: "Skydio", country: "United States", type: "Startup", domains: ["uas", "ai"], focus: "Autonomous small ISR quadcopters (X10D).", url: "https://www.skydio.com" },
  { name: "Shield AI", country: "United States", type: "Startup", domains: ["uas", "ai"], focus: "V-BAT VTOL UAS and Hivemind autonomy pilot.", url: "https://www.shield.ai" },
  { name: "Red Cat / Teal Drones", country: "United States", type: "Startup", domains: ["uas"], focus: "Teal 2 & Black Widow small NDAA-compliant drones.", url: "https://www.redcat.com" },
  { name: "BRINC Drones", country: "United States", type: "Startup", domains: ["uas"], focus: "Tactical indoor/first-responder drones.", url: "https://www.brincdrones.com" },
  { name: "Neros", country: "United States", type: "Startup", domains: ["uas"], focus: "Mass-manufactured FPV strike drones.", url: "https://www.neros.tech" },
  { name: "Firestorm Labs", country: "United States", type: "Startup", domains: ["uas"], focus: "3D-printed expeditionary UAS at the edge.", url: "https://www.firestorm.tech" },
  { name: "Kratos Defense", country: "United States", type: "Prime", domains: ["uas", "missiles"], focus: "Valkyrie XQ-58 & affordable jet UAS.", url: "https://www.kratosdefense.com" },

  /* ---- United States: Counter-UAS ---- */
  { name: "Epirus", country: "United States", type: "Startup", domains: ["cuas", "ew"], focus: "Leonidas high-power microwave C-UAS.", url: "https://www.epirusinc.com" },
  { name: "Fortem Technologies", country: "United States", type: "Startup", domains: ["cuas"], focus: "DroneHunter net-capture interceptor & TrueView radar.", url: "https://fortemtech.com" },
  { name: "SkySafe", country: "United States", type: "Startup", domains: ["cuas"], focus: "RF-based drone detection & airspace security.", url: "https://www.skysafe.io" },
  { name: "Dedrone (Axon)", country: "United States", type: "SME", domains: ["cuas"], focus: "Airspace detection & counter-drone software.", url: "https://www.dedrone.com" },

  /* ---- United States: Helicopters / eVTOL ---- */
  { name: "Sikorsky (Lockheed Martin)", country: "United States", type: "Prime", domains: ["helicopter"], focus: "Black Hawk, CH-53K, Raider-X rotorcraft.", url: "https://www.lockheedmartin.com/sikorsky" },
  { name: "Bell (Textron)", country: "United States", type: "Prime", domains: ["helicopter", "evtol"], focus: "V-280 Valor tiltrotor (FLRAA), 360 Invictus.", url: "https://www.bellflight.com" },
  { name: "Boeing Vertical Lift", country: "United States", type: "Prime", domains: ["helicopter"], focus: "AH-64 Apache, CH-47 Chinook, MH-139.", url: "https://www.boeing.com" },
  { name: "Piasecki Aircraft", country: "United States", type: "SME", domains: ["helicopter", "evtol"], focus: "Compound & hydrogen VTOL rotorcraft.", url: "https://www.piasecki.com" },
  { name: "Joby Aviation", country: "United States", type: "Startup", domains: ["evtol"], focus: "eVTOL air taxi with DoD/Agility Prime work.", url: "https://www.jobyaviation.com" },
  { name: "Archer Aviation", country: "United States", type: "Startup", domains: ["evtol"], focus: "Midnight eVTOL, defense JV with Anduril.", url: "https://www.archer.com" },

  /* ---- United Kingdom ---- */
  { name: "BAE Systems", country: "United Kingdom", type: "Prime", domains: ["uas", "missiles", "ew"], focus: "Combat air, munitions, autonomous systems.", url: "https://www.baesystems.com" },
  { name: "Malloy Aeronautics (BAE)", country: "United Kingdom", type: "SME", domains: ["uas"], focus: "Heavy-lift T-150/T-600 logistics drones.", url: "https://malloyaeronautics.com" },
  { name: "Callen-Lenz", country: "United Kingdom", type: "Startup", domains: ["uas", "ai"], focus: "Uncrewed air systems & autonomy integration.", url: "https://www.callenlenz.com" },
  { name: "Windracers", country: "United Kingdom", type: "Startup", domains: ["uas"], focus: "ULTRA fixed-wing heavy-lift autonomous cargo UAV.", url: "https://windracers.com" },
  { name: "OpenWorks Engineering", country: "United Kingdom", type: "SME", domains: ["cuas"], focus: "SkyWall net-capture counter-drone systems.", url: "https://openworksengineering.com" },
  { name: "Vertical Aerospace", country: "United Kingdom", type: "Startup", domains: ["evtol"], focus: "VX4 eVTOL aircraft.", url: "https://vertical-aerospace.com" },

  /* ---- France ---- */
  { name: "Thales", country: "France", type: "Prime", domains: ["uas", "ew", "cuas"], focus: "Spy'Ranger UAS, radar & C-UAS suites.", url: "https://www.thalesgroup.com" },
  { name: "Parrot", country: "France", type: "SME", domains: ["uas"], focus: "ANAFI USA & micro-UAS for defense/security.", url: "https://www.parrot.com" },
  { name: "Delair", country: "France", type: "Startup", domains: ["uas"], focus: "Long-range fixed-wing & UX11 tactical UAV.", url: "https://delair.aero" },
  { name: "Turgis & Gaillard", country: "France", type: "SME", domains: ["uas"], focus: "Aarok MALE combat drone.", url: "https://turgisgaillard.com" },
  { name: "CerbAir", country: "France", type: "Startup", domains: ["cuas"], focus: "RF drone detection & neutralisation.", url: "https://cerbair.com" },
  { name: "Airbus Helicopters", country: "France", type: "Prime", domains: ["helicopter"], focus: "H145M, Tiger, NH90 rotorcraft.", url: "https://www.airbus.com/helicopters" },

  /* ---- Germany ---- */
  { name: "Quantum Systems", country: "Germany", type: "Startup", domains: ["uas", "ai"], focus: "Vector & Reliant eVTOL fixed-wing ISR UAS.", url: "https://quantum-systems.com" },
  { name: "Helsing", country: "Germany", type: "Startup", domains: ["ai", "uas"], focus: "Battlefield AI software & HX-2 strike drones.", url: "https://helsing.ai" },
  { name: "Stark Defence", country: "Germany", type: "Startup", domains: ["uas", "missiles"], focus: "Virtus one-way-effect loitering munitions.", url: "https://stark-defence.com" },
  { name: "ARX Robotics", country: "Germany", type: "Startup", domains: ["ground", "ai"], focus: "Modular uncrewed ground vehicles.", url: "https://arxrobotics.co" },
  { name: "Rheinmetall", country: "Germany", type: "Prime", domains: ["uas", "cuas", "ground", "missiles"], focus: "Air defence, UGVs, loitering munitions.", url: "https://www.rheinmetall.com" },
  { name: "Volocopter", country: "Germany", type: "Startup", domains: ["evtol"], focus: "VoloCity / VoloDrone eVTOL platforms.", url: "https://www.volocopter.com" },

  /* ---- Türkiye ---- */
  { name: "Baykar", country: "Türkiye", type: "SME", domains: ["uas"], focus: "Bayraktar TB2 & Akıncı combat UAVs.", url: "https://baykartech.com" },
  { name: "TUSAŞ / TAI", country: "Türkiye", type: "Prime", domains: ["uas", "helicopter"], focus: "Anka UAS, T129 ATAK & T625 Gökbey helicopters.", url: "https://www.tusas.com" },
  { name: "STM", country: "Türkiye", type: "SME", domains: ["uas", "cuas"], focus: "Kargu loitering munitions & C-UAS.", url: "https://www.stm.com.tr" },

  /* ---- Poland ---- */
  { name: "WB Group", country: "Poland", type: "SME", domains: ["uas", "missiles"], focus: "FlyEye ISR & Warmate loitering munitions.", url: "https://www.wbgroup.pl" },
  { name: "PZL-Świdnik (Leonardo)", country: "Poland", type: "Prime", domains: ["helicopter"], focus: "AW149 & W-3 Sokół helicopters.", url: "https://www.pzl-swidnik.pl" },

  /* ---- Italy ---- */
  { name: "Leonardo Helicopters", country: "Italy", type: "Prime", domains: ["helicopter"], focus: "AW139/AW149/AW101 & AW249 attack rotorcraft.", url: "https://www.leonardo.com" },
  { name: "Leonardo (UAS)", country: "Italy", type: "Prime", domains: ["uas", "ew"], focus: "Falco family UAS, sensors & EW.", url: "https://www.leonardo.com" },

  /* ---- Netherlands ---- */
  { name: "Robin Radar Systems", country: "Netherlands", type: "SME", domains: ["cuas", "ew"], focus: "IRIS & Elvira drone-detection radars.", url: "https://www.robinradar.com" },
  { name: "Avular", country: "Netherlands", type: "Startup", domains: ["uas", "ground"], focus: "Modular autonomous drones & robots.", url: "https://www.avular.com" },

  /* ---- Estonia / Latvia / Nordics ---- */
  { name: "Marduk Technologies", country: "Estonia", type: "Startup", domains: ["cuas", "ai"], focus: "Optical AI-driven counter-UAS.", url: "https://marduk.tech" },
  { name: "Threod Systems", country: "Estonia", type: "SME", domains: ["uas"], focus: "Tactical fixed-wing & VTOL UAS.", url: "https://threod.com" },
  { name: "Origin Robotics", country: "Latvia", type: "Startup", domains: ["uas", "missiles"], focus: "BEAK loitering munition & strike UAS.", url: "https://www.originrobotics.com" },
  { name: "Nordic Air Defence", country: "Sweden", type: "Startup", domains: ["cuas"], focus: "Kinetic drone-interception effectors.", url: "https://www.nordicairdefence.com" },
  { name: "Saab", country: "Sweden", type: "Prime", domains: ["uas", "ew", "missiles"], focus: "Airborne ISR, EW & missile systems.", url: "https://www.saab.com" },
  { name: "Kongsberg", country: "Norway", type: "Prime", domains: ["missiles", "maritime", "cuas"], focus: "NSM/JSM missiles & remote weapon stations.", url: "https://www.kongsberg.com" },
  { name: "Nordic Unmanned", country: "Norway", type: "SME", domains: ["uas", "maritime"], focus: "Drone-as-a-service ISR & maritime UAS.", url: "https://www.nordicunmanned.com" },
  { name: "Sensofusion", country: "Finland", type: "Startup", domains: ["cuas"], focus: "AIRFENCE drone detection & takeover.", url: "https://www.sensofusion.com" },

  /* ---- Portugal / Czechia ---- */
  { name: "Tekever", country: "Portugal", type: "SME", domains: ["uas", "maritime", "ai"], focus: "AR3 & AR5 maritime ISR UAS with AI.", url: "https://www.tekever.com" },
  { name: "Primoco UAV", country: "Czechia", type: "SME", domains: ["uas"], focus: "One-150 fixed-wing long-endurance UAV.", url: "https://www.primoco-uav.com" },

  /* ---- Canada / Australia ---- */
  { name: "InDro Robotics", country: "Canada", type: "Startup", domains: ["uas", "ai"], focus: "BVLOS drone operations & autonomy.", url: "https://indrorobotics.com" },
  { name: "DroneShield", country: "Australia", type: "SME", domains: ["cuas", "ai"], focus: "RfPatrol & DroneGun counter-UAS.", url: "https://www.droneshield.com" },
  { name: "Sypaq Systems", country: "Australia", type: "SME", domains: ["uas"], focus: "Corvo precision payload cardboard drones.", url: "https://sypaq.com.au" },
];

/* ------------------------------------------------------------------ */
/* Helpers (used by both server and browser)                          */
/* ------------------------------------------------------------------ */

/* Whole-token match: treats spaces/hyphens/punctuation as boundaries so short
 * synonyms ("ai", "ew", "uas") don't false-match inside longer words
 * ("maintain", "new", "counter-uas"). */
function wordMatch(text, syn) {
  const esc = syn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(text);
}

/* Map free-typed interest text to canonical domain keys. Counter-UAS is
 * detected first, and its phrases are stripped before plain-UAS detection so
 * "counter-uas" alone doesn't also pull every drone company. */
function detectDomains(text) {
  const t = String(text || "").toLowerCase();
  const hits = new Set();

  const isCuas = DOMAINS.cuas.synonyms.some((s) => wordMatch(t, s));
  if (isCuas) hits.add("cuas");

  // For plain-UAS detection, remove counter-UAS wording (and the words
  // "counter"/"anti") so their embedded "uas"/"drone" doesn't trigger it.
  let uasText = t;
  if (isCuas) {
    for (const s of DOMAINS.cuas.synonyms) uasText = uasText.split(s).join(" ");
    uasText = uasText.replace(/counter[-\s]?/g, " ").replace(/anti[-\s]?/g, " ");
  }

  for (const [key, d] of Object.entries(DOMAINS)) {
    if (key === "cuas") continue;
    const src = key === "uas" ? uasText : t;
    if (d.synonyms.some((s) => wordMatch(src, s))) hits.add(key);
  }
  return [...hits];
}

/* Resolve a country selection to a Set of country names to match against,
 * or null for "any / global". "NATO" expands to every member state. */
function resolveCountries(code) {
  if (!code || code === "ANY") return null;
  if (code === "NATO") return new Set(NATO_MEMBERS);
  const c = COUNTRIES.find((x) => x.code === code);
  return c ? new Set([c.name]) : null;
}

/* Filter the curated company database by interest + country. */
function searchCompanies(interest, countryCode) {
  const domains = detectDomains(interest);
  const countrySet = resolveCountries(countryCode);
  const kw = String(interest || "").toLowerCase().trim();

  let list = COMPANIES.filter((c) => !countrySet || countrySet.has(c.country));

  if (domains.length) {
    list = list.filter((c) => c.domains.some((d) => domains.includes(d)));
  } else if (kw) {
    list = list.filter((c) =>
      (c.name + " " + c.focus + " " + c.domains.join(" ")).toLowerCase().includes(kw)
    );
  }

  // Startups first (that's the part users most often can't find elsewhere),
  // then SMEs, then primes; alphabetical within a tier.
  const rank = { Startup: 0, SME: 1, Prime: 2 };
  list.sort((a, b) => (rank[a.type] - rank[b.type]) || a.name.localeCompare(b.name));
  return { domains, companies: list };
}

/* ------------------------------------------------------------------ */
/* Export for Node + attach to window for the browser                 */
/* ------------------------------------------------------------------ */
const BD_DATA = {
  NOTICE_TYPES, NATO_MEMBERS, COUNTRIES, DOMAINS, COMPANIES,
  detectDomains, resolveCountries, searchCompanies, tedUrl,
};

if (typeof module !== "undefined" && module.exports) module.exports = BD_DATA;
if (typeof window !== "undefined") window.BD_DATA = BD_DATA;
