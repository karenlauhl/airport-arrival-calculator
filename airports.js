/* ============================================================
   SECTION 1 — AIRPORT DATA
   To add an airport, append one entry to RAW_AIRPORTS. Nothing
   else needs to change: the picker, info card and route options
   all read from AIRPORTS, which is built from this list.

   Fields:
     region     picker group
     tz         IANA time zone (not used by the model yet — the
                device clock is assumed to match the airport)
     pax        annual passengers, millions (approximate, ~2025)
     blurb      second half of the size label
     terminals  layout note
     distance   how far from the town/city it serves
     fastTrack  true = paid Fast Track sold, false = not sold,
                "premium" = premium cabin / airline status only
     peak       busy departure bank, or omitted for the default
     official   airport's own advice in minutes; verified=true only
                where checked against the airport's own site
     routes     keys into ROUTES that actually depart from here
   ============================================================ */

/* Size tiers, from annual passengers. One rule for every airport,
   so the adjustment is comparable across the list. */
const SIZE_TIERS = [
  { maxPax: 1,        adj: -10, word: "Tiny" },
  { maxPax: 5,        adj: -5,  word: "Small" },
  { maxPax: 15,       adj: 0,   word: "Medium" },
  { maxPax: 40,       adj: 15,  word: "Large" },
  { maxPax: Infinity, adj: 20,  word: "Very large" }
];

const DEFAULT_PEAK = { start: "05:00", end: "08:00", adj: 5, note: "early departure bank" };
const DEFAULT_OFFICIAL = { shortHaul: 120, longHaul: 180, verified: false };
// Island and tiny regional airports: check-in typically closes 20–30 min out.
const TINY_OFFICIAL = { shortHaul: 60, longHaul: null, verified: false };

const RAW_AIRPORTS = {
  /* ---- London ---- */
  LHR: { region: "London", name: "Heathrow", full: "London Heathrow", pax: 84.5,
    blurb: "the UK's busiest, four terminals", terminals: "T2, T3, T4, T5 — check which; they're far apart",
    distance: "~24 km west of central London", fastTrack: "premium",
    peak: { start: "06:00", end: "09:00", adj: 10, note: "morning long-haul arrivals and short-haul departure bank" },
    routes: ["uk", "cta", "europe", "longHaul"] },
  LGW: { region: "London", name: "Gatwick", full: "London Gatwick", pax: 42.8,
    blurb: "two terminals, heavy holiday traffic", terminals: "North and South — check which",
    distance: "~45 km south of central London", fastTrack: true,
    peak: { start: "05:00", end: "08:30", adj: 10, note: "early holiday departure bank" },
    routes: ["uk", "cta", "europe", "longHaul"] },
  STN: { region: "London", name: "Stansted", full: "London Stansted", pax: 29.8,
    blurb: "low-cost hub, long early queues", terminals: "Single terminal, satellite gates by shuttle",
    distance: "~55 km north-east of central London", fastTrack: true,
    peak: { start: "05:00", end: "08:00", adj: 10, note: "early low-cost departure bank" },
    routes: ["uk", "cta", "europe", "longHaul"] },
  LTN: { region: "London", name: "Luton", full: "London Luton", pax: 17.8,
    blurb: "low-cost, single terminal", terminals: "Single terminal",
    distance: "~55 km north of central London", fastTrack: true,
    peak: { start: "05:00", end: "08:00", adj: 10, note: "early low-cost departure bank" },
    routes: ["uk", "cta", "europe"] },
  LCY: { region: "London", name: "London City", full: "London City", pax: 3.6,
    blurb: "business-focused, very quick to get through", terminals: "Single terminal",
    distance: "~11 km east of central London", fastTrack: false,
    peak: { start: "06:00", end: "09:00", adj: 5, note: "morning business bank" },
    routes: ["uk", "cta", "europe"] },
  SEN: { region: "London", name: "Southend", full: "London Southend", pax: 0.7,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~65 km east of central London, next to Southend", fastTrack: false,
    routes: ["europe"] },

  /* ---- England ---- */
  MAN: { region: "England", name: "Manchester", full: "Manchester Airport", pax: 32.1,
    blurb: "busiest outside London, multiple terminals", terminals: "T1/T3 and T2 — check which",
    distance: "~14 km south of Manchester", fastTrack: true,
    peak: { start: "05:00", end: "08:00", adj: 10, note: "early holiday departure bank" },
    routes: ["uk", "cta", "europe", "longHaul"] },
  BHX: { region: "England", name: "Birmingham", full: "Birmingham Airport", pax: 13.5,
    blurb: "single terminal, busy mornings", terminals: "Single terminal",
    distance: "~10 km east of Birmingham", fastTrack: true,
    routes: ["uk", "cta", "europe", "longHaul"] },
  BRS: { region: "England", name: "Bristol", full: "Bristol Airport", pax: 10.6,
    blurb: "single terminal, rural approach roads", terminals: "Single terminal",
    distance: "~13 km south-west of Bristol", fastTrack: true,
    routes: ["uk", "cta", "europe"] },
  LPL: { region: "England", name: "Liverpool", full: "Liverpool John Lennon", pax: 5.2,
    blurb: "single terminal, low-cost heavy", terminals: "Single terminal",
    distance: "~12 km south-east of Liverpool", fastTrack: true,
    routes: ["uk", "cta", "europe"] },
  NCL: { region: "England", name: "Newcastle", full: "Newcastle International", pax: 5.0,
    blurb: "single terminal", terminals: "Single terminal",
    distance: "~10 km north-west of Newcastle", fastTrack: true,
    routes: ["uk", "cta", "europe", "longHaul"] },
  LBA: { region: "England", name: "Leeds Bradford", full: "Leeds Bradford", pax: 4.2,
    blurb: "single terminal, often busy for its size", terminals: "Single terminal",
    distance: "~11 km north-west of Leeds", fastTrack: true,
    routes: ["uk", "cta", "europe"] },
  EMA: { region: "England", name: "East Midlands", full: "East Midlands Airport", pax: 4.1,
    blurb: "single terminal", terminals: "Single terminal",
    distance: "Between Derby and Nottingham, ~20 km from each", fastTrack: true,
    routes: ["uk", "cta", "europe"] },
  BOH: { region: "England", name: "Bournemouth", full: "Bournemouth Airport", pax: 0.9,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~6 km north-east of Bournemouth", fastTrack: null,
    routes: ["cta", "europe"] },
  EXT: { region: "England", name: "Exeter", full: "Exeter Airport", pax: 0.9,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~7 km east of Exeter", fastTrack: null,
    routes: ["uk", "cta", "europe"] },
  SOU: { region: "England", name: "Southampton", full: "Southampton Airport", pax: 0.8,
    blurb: "quiet, station right outside", terminals: "Single terminal",
    distance: "~6 km north of Southampton, own railway station", fastTrack: null,
    routes: ["uk", "cta", "europe"] },
  NQY: { region: "England", name: "Newquay", full: "Cornwall Airport Newquay", pax: 0.5,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~8 km north-east of Newquay", fastTrack: false,
    routes: ["uk", "cta", "europe"] },
  NWI: { region: "England", name: "Norwich", full: "Norwich Airport", pax: 0.4,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~5 km north of Norwich", fastTrack: false,
    routes: ["uk", "cta", "europe"] },
  MME: { region: "England", name: "Teesside", full: "Teesside International", pax: 0.4,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~10 km east of Darlington", fastTrack: false,
    routes: ["uk", "europe"] },
  HUY: { region: "England", name: "Humberside", full: "Humberside Airport", pax: 0.15,
    blurb: "very few flights a day", terminals: "Single terminal",
    distance: "~25 km west of Grimsby", fastTrack: false,
    routes: ["europe"] },
  ISC: { region: "England", name: "Isles of Scilly", full: "Isles of Scilly (St Mary's)", pax: 0.1,
    blurb: "small island airstrip", terminals: "Single small terminal",
    distance: "~1.5 km from Hugh Town, St Mary's", fastTrack: false,
    routes: ["uk"] },
  LEQ: { region: "England", name: "Land's End", full: "Land's End Airport", pax: 0.05,
    blurb: "grass airstrip, Scilly flights only", terminals: "Single small terminal",
    distance: "~10 km west of Penzance", fastTrack: false,
    routes: ["uk"] },

  /* ---- Scotland ---- */
  EDI: { region: "Scotland", name: "Edinburgh", full: "Edinburgh Airport", pax: 17.0,
    blurb: "Scotland's busiest, single terminal", terminals: "Single terminal",
    distance: "~13 km west of Edinburgh", fastTrack: true,
    peak: { start: "05:30", end: "08:30", adj: 10, note: "early departure bank" },
    routes: ["uk", "cta", "europe", "longHaul"] },
  GLA: { region: "Scotland", name: "Glasgow", full: "Glasgow Airport", pax: 7.5,
    blurb: "single terminal", terminals: "Single terminal",
    distance: "~13 km west of Glasgow", fastTrack: true,
    routes: ["uk", "cta", "europe", "longHaul"] },
  ABZ: { region: "Scotland", name: "Aberdeen", full: "Aberdeen International", pax: 2.4,
    blurb: "single terminal, oil-industry traffic", terminals: "Single terminal",
    distance: "~11 km north-west of Aberdeen", fastTrack: true,
    routes: ["uk", "cta", "europe"] },
  INV: { region: "Scotland", name: "Inverness", full: "Inverness Airport", pax: 0.9,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~13 km north-east of Inverness", fastTrack: false,
    routes: ["uk", "cta", "europe"] },
  PIK: { region: "Scotland", name: "Prestwick", full: "Glasgow Prestwick", pax: 0.6,
    blurb: "low-cost holiday flights, own railway station", terminals: "Single terminal",
    distance: "~50 km south-west of Glasgow", fastTrack: false,
    routes: ["europe"] },
  WIC: { region: "Scotland", name: "Wick", full: "Wick John O'Groats", pax: 0.01,
    blurb: "a handful of flights a week", terminals: "Single small terminal",
    distance: "~2 km north of Wick", fastTrack: false,
    routes: ["uk"] },

  /* ---- Scottish islands ---- */
  KOI: { region: "Scottish islands", name: "Kirkwall", full: "Kirkwall (Orkney)", pax: 0.2,
    blurb: "island airport", terminals: "Single terminal",
    distance: "~4 km south-east of Kirkwall", fastTrack: false,
    routes: ["uk"] },
  LSI: { region: "Scottish islands", name: "Sumburgh", full: "Sumburgh (Shetland)", pax: 0.25,
    blurb: "island airport", terminals: "Single terminal",
    distance: "~35 km south of Lerwick", fastTrack: false,
    routes: ["uk"] },
  SYY: { region: "Scottish islands", name: "Stornoway", full: "Stornoway (Lewis)", pax: 0.12,
    blurb: "island airport", terminals: "Single terminal",
    distance: "~3 km east of Stornoway", fastTrack: false,
    routes: ["uk"] },
  BEB: { region: "Scottish islands", name: "Benbecula", full: "Benbecula", pax: 0.03,
    blurb: "island airport", terminals: "Single small terminal",
    distance: "On Benbecula, Outer Hebrides", fastTrack: false,
    routes: ["uk"] },
  BRR: { region: "Scottish islands", name: "Barra", full: "Barra (beach runway)", pax: 0.01,
    blurb: "beach runway, tide-dependent", terminals: "Single small terminal",
    distance: "Traigh Mhòr, north of Barra", fastTrack: false,
    routes: ["uk"] },
  TRE: { region: "Scottish islands", name: "Tiree", full: "Tiree", pax: 0.01,
    blurb: "island airport", terminals: "Single small terminal",
    distance: "~3 km from Scarinish", fastTrack: false,
    routes: ["uk"] },
  ILY: { region: "Scottish islands", name: "Islay", full: "Islay", pax: 0.03,
    blurb: "island airport", terminals: "Single small terminal",
    distance: "~7 km from Bowmore", fastTrack: false,
    routes: ["uk"] },
  CAL: { region: "Scottish islands", name: "Campbeltown", full: "Campbeltown (Kintyre)", pax: 0.01,
    blurb: "a few Glasgow flights a week", terminals: "Single small terminal",
    distance: "~5 km west of Campbeltown", fastTrack: false,
    routes: ["uk"] },

  /* ---- Wales ---- */
  CWL: { region: "Wales", name: "Cardiff", full: "Cardiff Airport", pax: 1.0,
    blurb: "Wales's main airport, single terminal", terminals: "Single terminal",
    distance: "~20 km south-west of Cardiff", fastTrack: true,
    routes: ["uk", "cta", "europe"] },

  /* ---- Northern Ireland ---- */
  BFS: { region: "Northern Ireland", name: "Belfast Intl", full: "Belfast International (Aldergrove)", pax: 6,
    blurb: "busiest in Northern Ireland", terminals: "Single terminal",
    distance: "~20 km from Belfast city centre", fastTrack: true,
    peak: { start: "05:00", end: "08:00", adj: 10, note: "early low-cost departure bank" },
    official: { shortHaul: 120, longHaul: 180, verified: true },
    routes: ["uk", "cta", "europe", "longHaul"] },
  BHD: { region: "Northern Ireland", name: "Belfast City", full: "George Best Belfast City", pax: 2,
    blurb: "compact and close in", terminals: "Single terminal",
    distance: "~4 km from Belfast city centre", fastTrack: true,
    peak: { start: "06:00", end: "08:00", adj: 5, note: "early business bank to London" },
    official: { shortHaul: 120, longHaul: null, verified: false },
    routes: ["uk", "cta", "europe"] },
  LDY: { region: "Northern Ireland", name: "City of Derry", full: "City of Derry Airport", pax: 0.2,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~11 km north-east of Derry", fastTrack: false,
    routes: ["uk", "europe"] },

  /* ---- Ireland ---- */
  DUB: { region: "Ireland", tz: "Europe/Dublin", name: "Dublin", full: "Dublin Airport", pax: 34,
    blurb: "busiest in Ireland, two terminals", terminals: "T1 and T2 — check which before you go",
    distance: "~10 km from Dublin city centre", fastTrack: true,
    peak: { start: "05:00", end: "12:00", adj: 10, note: "T2 morning transatlantic bank" },
    official: { shortHaul: 120, longHaul: 180, verified: true },
    routes: ["cta", "europe", "usPreclear", "longHaul"] }
};

const REGIONS = ["London", "England", "Scotland", "Scottish islands", "Wales", "Northern Ireland", "Ireland"];

function sizeTier(pax) {
  return SIZE_TIERS.find(t => pax < t.maxPax);
}

function fmtPax(pax) {
  if (pax < 0.1) return "under 100,000";
  if (pax < 1) return `~${(Math.round(pax * 100) * 10000).toLocaleString("en-GB")}`;
  return `~${Number(pax.toFixed(1))} million`;
}

/* Expand each raw entry into the shape the model and UI read. */
const AIRPORTS = Object.fromEntries(Object.entries(RAW_AIRPORTS).map(([code, a]) => {
  const tier = sizeTier(a.pax);
  const tiny = tier.adj === SIZE_TIERS[0].adj;
  return [code, {
    ...a,
    code,
    tz: a.tz || "Europe/London",
    tiny,
    sizeAdj: tier.adj,
    sizeLabel: `${tier.word} — ${a.blurb}`,
    paxPerYear: fmtPax(a.pax),
    peak: a.peak !== undefined ? a.peak : (tiny ? null : DEFAULT_PEAK),
    official: a.official || (tiny ? TINY_OFFICIAL : DEFAULT_OFFICIAL)
  }];
}));

const ROUTES = {
  uk:         { label: "Elsewhere in the UK",      sub: "domestic — no immigration",           adj: 0,  long: false },
  cta:        { label: "Ireland / UK / Channel Islands / Isle of Man", sub: "Common Travel Area — no immigration", adj: 0, long: false },
  europe:     { label: "Europe",                   sub: "short-haul international",            adj: 10, long: false },
  usPreclear: { label: "United States",            sub: "full US preclearance before you fly", adj: 60, long: true  },
  longHaul:   { label: "Long-haul (not the US)",   sub: "bigger aircraft, longer queues",      adj: 25, long: true  }
};
