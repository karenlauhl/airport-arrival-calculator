/* ============================================================
   SECTION 1 — AIRPORT DATA
   To add an airport, append one entry to RAW_AIRPORTS. Nothing
   else needs to change: the picker, info card and route options
   all read from AIRPORTS, which is built from this list.

   Fields:
     region     picker group within the country
     lat, lon   airport position, for "Use my location"
     rail       true where a train, metro or tram stops at the terminal
     transit    optional [{ name, url }]: the airport's own public-transport
                page and main airport services. Only links checked against
                a published source — leave it out rather than guess.
     roadFactor optional: road distance ÷ straight line, where roads go
                the long way round (default 1.25–1.35)
     landmass   only for island airports — see LANDMASSES; otherwise
                derived (Ireland for NI/Ireland, else mainland GB)
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
  LHR: { region: "London", lat: 51.47, lon: -0.454, rail: true, name: "Heathrow", full: "London Heathrow", pax: 84.5,
    blurb: "the UK's busiest, four terminals", terminals: "T2, T3, T4, T5 — check which; they're far apart",
    distance: "~24 km west of central London", fastTrack: "premium",
    peak: { start: "06:00", end: "09:00", adj: 10, note: "morning long-haul arrivals and short-haul departure bank" },
    routes: ["uk", "cta", "europe", "longHaul"],
    transit: [{ name: "Heathrow Express", url: "https://www.heathrowexpress.com/" }, { name: "Heathrow: transport and directions", url: "https://www.heathrow.com/transport-and-directions" }] },
  LGW: { region: "London", lat: 51.153, lon: -0.182, rail: true, name: "Gatwick", full: "London Gatwick", pax: 42.8,
    blurb: "two terminals, heavy holiday traffic", terminals: "North and South — check which",
    distance: "~45 km south of central London", fastTrack: true,
    peak: { start: "05:00", end: "08:30", adj: 10, note: "early holiday departure bank" },
    routes: ["uk", "cta", "europe", "longHaul"],
    transit: [{ name: "Gatwick Express", url: "https://www.gatwickexpress.com/" }, { name: "Gatwick: to and from London", url: "https://gatwickairport.com/transport-options/to-from-london.html" }] },
  STN: { region: "London", lat: 51.885, lon: 0.235, rail: true, name: "Stansted", full: "London Stansted", pax: 29.8,
    blurb: "low-cost hub, long early queues", terminals: "Single terminal, satellite gates by shuttle",
    distance: "~55 km north-east of central London", fastTrack: true,
    peak: { start: "05:00", end: "08:00", adj: 10, note: "early low-cost departure bank" },
    routes: ["uk", "cta", "europe", "longHaul"],
    transit: [{ name: "Stansted Express", url: "https://www.stanstedexpress.com/" }] },
  LTN: { region: "London", lat: 51.875, lon: -0.368, rail: true, name: "Luton", full: "London Luton", pax: 17.8,
    blurb: "low-cost, single terminal", terminals: "Single terminal",
    distance: "~55 km north of central London", fastTrack: true,
    peak: { start: "05:00", end: "08:00", adj: 10, note: "early low-cost departure bank" },
    routes: ["uk", "cta", "europe"],
    transit: [{ name: "Luton: getting to the airport", url: "https://www.london-luton.co.uk/to-and-from-lla" }] },
  LCY: { region: "London", lat: 51.505, lon: 0.055, rail: true, name: "London City", full: "London City", pax: 3.6,
    blurb: "business-focused, very quick to get through", terminals: "Single terminal",
    distance: "~11 km east of central London", fastTrack: false,
    peak: { start: "06:00", end: "09:00", adj: 5, note: "morning business bank" },
    routes: ["uk", "cta", "europe"] },
  SEN: { region: "London", lat: 51.571, lon: 0.696, rail: true, name: "Southend", full: "London Southend", pax: 0.7,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~65 km east of central London, next to Southend", fastTrack: false,
    routes: ["europe"] },

  /* ---- England ---- */
  MAN: { region: "England", lat: 53.354, lon: -2.275, rail: true, name: "Manchester", full: "Manchester Airport", pax: 32.1,
    blurb: "busiest outside London, multiple terminals", terminals: "T1/T3 and T2 — check which",
    distance: "~14 km south of Manchester", fastTrack: true,
    peak: { start: "05:00", end: "08:00", adj: 10, note: "early holiday departure bank" },
    routes: ["uk", "cta", "europe", "longHaul"] },
  BHX: { region: "England", lat: 52.454, lon: -1.748, rail: true, name: "Birmingham", full: "Birmingham Airport", pax: 13.5,
    blurb: "single terminal, busy mornings", terminals: "Single terminal",
    distance: "~10 km east of Birmingham", fastTrack: true,
    routes: ["uk", "cta", "europe", "longHaul"],
    transit: [{ name: "Birmingham Airport: by train", url: "https://www.birminghamairport.co.uk/transport-links/by-train/" }] },
  BRS: { region: "England", lat: 51.383, lon: -2.719, name: "Bristol", full: "Bristol Airport", pax: 10.6,
    blurb: "single terminal, rural approach roads", terminals: "Single terminal",
    distance: "~13 km south-west of Bristol", fastTrack: true,
    routes: ["uk", "cta", "europe"] },
  LPL: { region: "England", lat: 53.334, lon: -2.85, name: "Liverpool", full: "Liverpool John Lennon", pax: 5.2,
    blurb: "single terminal, low-cost heavy", terminals: "Single terminal",
    distance: "~12 km south-east of Liverpool", fastTrack: true,
    routes: ["uk", "cta", "europe"] },
  NCL: { region: "England", lat: 55.037, lon: -1.692, rail: true, name: "Newcastle", full: "Newcastle International", pax: 5.0,
    blurb: "single terminal", terminals: "Single terminal",
    distance: "~10 km north-west of Newcastle", fastTrack: true,
    routes: ["uk", "cta", "europe", "longHaul"] },
  LBA: { region: "England", lat: 53.866, lon: -1.661, name: "Leeds Bradford", full: "Leeds Bradford", pax: 4.2,
    blurb: "single terminal, often busy for its size", terminals: "Single terminal",
    distance: "~11 km north-west of Leeds", fastTrack: true,
    routes: ["uk", "cta", "europe"] },
  EMA: { region: "England", lat: 52.831, lon: -1.328, name: "East Midlands", full: "East Midlands Airport", pax: 4.1,
    blurb: "single terminal", terminals: "Single terminal",
    distance: "Between Derby and Nottingham, ~20 km from each", fastTrack: true,
    routes: ["uk", "cta", "europe"] },
  BOH: { region: "England", lat: 50.78, lon: -1.843, name: "Bournemouth", full: "Bournemouth Airport", pax: 0.9,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~6 km north-east of Bournemouth", fastTrack: null,
    routes: ["cta", "europe"] },
  EXT: { region: "England", lat: 50.734, lon: -3.414, name: "Exeter", full: "Exeter Airport", pax: 0.9,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~7 km east of Exeter", fastTrack: null,
    routes: ["uk", "cta", "europe"] },
  SOU: { region: "England", lat: 50.95, lon: -1.357, rail: true, name: "Southampton", full: "Southampton Airport", pax: 0.8,
    blurb: "quiet, station right outside", terminals: "Single terminal",
    distance: "~6 km north of Southampton, own railway station", fastTrack: null,
    routes: ["uk", "cta", "europe"] },
  NQY: { region: "England", lat: 50.441, lon: -4.995, name: "Newquay", full: "Cornwall Airport Newquay", pax: 0.5,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~8 km north-east of Newquay", fastTrack: false,
    routes: ["uk", "cta", "europe"] },
  NWI: { region: "England", lat: 52.676, lon: 1.283, name: "Norwich", full: "Norwich Airport", pax: 0.4,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~5 km north of Norwich", fastTrack: false,
    routes: ["uk", "cta", "europe"] },
  MME: { region: "England", lat: 54.509, lon: -1.429, name: "Teesside", full: "Teesside International", pax: 0.4,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~10 km east of Darlington", fastTrack: false,
    routes: ["uk", "europe"] },
  HUY: { region: "England", lat: 53.574, lon: -0.351, name: "Humberside", full: "Humberside Airport", pax: 0.15,
    blurb: "very few flights a day", terminals: "Single terminal",
    distance: "~25 km west of Grimsby", fastTrack: false,
    routes: ["europe"] },
  ISC: { region: "England", lat: 49.913, lon: -6.292, landmass: "scilly", name: "Isles of Scilly", full: "Isles of Scilly (St Mary's)", pax: 0.1,
    blurb: "small island airstrip", terminals: "Single small terminal",
    distance: "~1.5 km from Hugh Town, St Mary's", fastTrack: false,
    routes: ["uk"] },
  LEQ: { region: "England", lat: 50.103, lon: -5.671, name: "Land's End", full: "Land's End Airport", pax: 0.05,
    blurb: "grass airstrip, Scilly flights only", terminals: "Single small terminal",
    distance: "~10 km west of Penzance", fastTrack: false,
    routes: ["uk"] },

  /* ---- Scotland ---- */
  EDI: { region: "Scotland", lat: 55.95, lon: -3.373, rail: true, name: "Edinburgh", full: "Edinburgh Airport", pax: 17.0,
    blurb: "Scotland's busiest, single terminal", terminals: "Single terminal",
    distance: "~13 km west of Edinburgh", fastTrack: true,
    peak: { start: "05:30", end: "08:30", adj: 10, note: "early departure bank" },
    routes: ["uk", "cta", "europe", "longHaul"],
    transit: [{ name: "Edinburgh Airport: city bus links", url: "https://www.edinburghairport.com/transport-links/buses-and-coaches/edinburgh-city-bus-links" }, { name: "Lothian Buses (Airlink 100)", url: "https://www.lothianbuses.com/" }] },
  GLA: { region: "Scotland", lat: 55.872, lon: -4.433, name: "Glasgow", full: "Glasgow Airport", pax: 7.5,
    blurb: "single terminal", terminals: "Single terminal",
    distance: "~13 km west of Glasgow", fastTrack: true,
    routes: ["uk", "cta", "europe", "longHaul"],
    transit: [{ name: "Glasgow Airport Express 500", url: "https://www.firstbus.co.uk/greater-glasgow/glasgow-airport-express" }, { name: "Glasgow Airport: Express 500", url: "https://www.glasgowairport.com/to-and-from/glasgow-airport-express-service-500/" }] },
  ABZ: { region: "Scotland", lat: 57.202, lon: -2.198, name: "Aberdeen", full: "Aberdeen International", pax: 2.4,
    blurb: "single terminal, oil-industry traffic", terminals: "Single terminal",
    distance: "~11 km north-west of Aberdeen", fastTrack: true,
    routes: ["uk", "cta", "europe"] },
  INV: { region: "Scotland", lat: 57.542, lon: -4.048, name: "Inverness", full: "Inverness Airport", pax: 0.9,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~13 km north-east of Inverness", fastTrack: false,
    routes: ["uk", "cta", "europe"] },
  PIK: { region: "Scotland", lat: 55.509, lon: -4.587, rail: true, name: "Prestwick", full: "Glasgow Prestwick", pax: 0.6,
    blurb: "low-cost holiday flights, own railway station", terminals: "Single terminal",
    distance: "~50 km south-west of Glasgow", fastTrack: false,
    routes: ["europe"] },
  WIC: { region: "Scotland", lat: 58.459, lon: -3.093, name: "Wick", full: "Wick John O'Groats", pax: 0.01,
    blurb: "a handful of flights a week", terminals: "Single small terminal",
    distance: "~2 km north of Wick", fastTrack: false,
    routes: ["uk"] },

  /* ---- Scottish islands ---- */
  KOI: { region: "Scottish islands", lat: 58.958, lon: -2.905, landmass: "orkney", name: "Kirkwall", full: "Kirkwall (Orkney)", pax: 0.2,
    blurb: "island airport", terminals: "Single terminal",
    distance: "~4 km south-east of Kirkwall", fastTrack: false,
    routes: ["uk"] },
  LSI: { region: "Scottish islands", lat: 59.879, lon: -1.296, landmass: "shetland", name: "Sumburgh", full: "Sumburgh (Shetland)", pax: 0.25,
    blurb: "island airport", terminals: "Single terminal",
    distance: "~35 km south of Lerwick", fastTrack: false,
    routes: ["uk"] },
  SYY: { region: "Scottish islands", lat: 58.216, lon: -6.331, landmass: "lewis", name: "Stornoway", full: "Stornoway (Lewis)", pax: 0.12,
    blurb: "island airport", terminals: "Single terminal",
    distance: "~3 km east of Stornoway", fastTrack: false,
    routes: ["uk"] },
  BEB: { region: "Scottish islands", lat: 57.481, lon: -7.363, landmass: "uist", name: "Benbecula", full: "Benbecula", pax: 0.03,
    blurb: "island airport", terminals: "Single small terminal",
    distance: "On Benbecula, Outer Hebrides", fastTrack: false,
    routes: ["uk"] },
  BRR: { region: "Scottish islands", lat: 57.023, lon: -7.443, landmass: "barra", name: "Barra", full: "Barra (beach runway)", pax: 0.01,
    blurb: "beach runway, tide-dependent", terminals: "Single small terminal",
    distance: "Traigh Mhòr, north of Barra", fastTrack: false,
    routes: ["uk"] },
  TRE: { region: "Scottish islands", lat: 56.499, lon: -6.869, landmass: "tiree", name: "Tiree", full: "Tiree", pax: 0.01,
    blurb: "island airport", terminals: "Single small terminal",
    distance: "~3 km from Scarinish", fastTrack: false,
    routes: ["uk"] },
  ILY: { region: "Scottish islands", lat: 55.682, lon: -6.257, landmass: "islay", name: "Islay", full: "Islay", pax: 0.03,
    blurb: "island airport", terminals: "Single small terminal",
    distance: "~7 km from Bowmore", fastTrack: false,
    routes: ["uk"] },
  CAL: { region: "Scottish islands", lat: 55.437, lon: -5.686, roadFactor: 2.5, name: "Campbeltown", full: "Campbeltown (Kintyre)", pax: 0.01,
    blurb: "a few Glasgow flights a week", terminals: "Single small terminal",
    distance: "~5 km west of Campbeltown", fastTrack: false,
    routes: ["uk"] },

  /* ---- Wales ---- */
  CWL: { region: "Wales", lat: 51.397, lon: -3.343, name: "Cardiff", full: "Cardiff Airport", pax: 1.0,
    blurb: "Wales's main airport, single terminal", terminals: "Single terminal",
    distance: "~20 km south-west of Cardiff", fastTrack: true,
    routes: ["uk", "cta", "europe"] },

  /* ---- Northern Ireland ---- */
  BFS: { region: "Northern Ireland", lat: 54.658, lon: -6.216, name: "Belfast Intl", full: "Belfast International (Aldergrove)", pax: 6,
    blurb: "busiest in Northern Ireland", terminals: "Single terminal",
    distance: "~20 km from Belfast city centre", fastTrack: true,
    peak: { start: "05:00", end: "08:00", adj: 10, note: "early low-cost departure bank" },
    official: { shortHaul: 120, longHaul: 180, verified: true },
    routes: ["uk", "cta", "europe", "longHaul"],
    transit: [{ name: "Belfast Intl: bus and coach", url: "https://www.belfastairport.com/to-from/by-buscoach" }] },
  BHD: { region: "Northern Ireland", lat: 54.618, lon: -5.873, rail: true, name: "Belfast City", full: "George Best Belfast City", pax: 2,
    blurb: "compact and close in", terminals: "Single terminal",
    distance: "~4 km from Belfast city centre", fastTrack: true,
    peak: { start: "06:00", end: "08:00", adj: 5, note: "early business bank to London" },
    official: { shortHaul: 120, longHaul: null, verified: false },
    routes: ["uk", "cta", "europe"],
    transit: [{ name: "Belfast City: getting to the airport", url: "https://www.belfastcityairport.com/Getting-to-the-airport" }] },
  LDY: { region: "Northern Ireland", lat: 55.043, lon: -7.161, name: "City of Derry", full: "City of Derry Airport", pax: 0.2,
    blurb: "quiet single terminal", terminals: "Single terminal",
    distance: "~11 km north-east of Derry", fastTrack: false,
    routes: ["uk", "europe"] },

  /* ---- Ireland ---- */
  DUB: { region: "Ireland", lat: 53.421, lon: -6.27, tz: "Europe/Dublin", name: "Dublin", full: "Dublin Airport", pax: 34,
    blurb: "busiest in Ireland, two terminals", terminals: "T1 and T2 — check which before you go",
    distance: "~10 km from Dublin city centre", fastTrack: true,
    peak: { start: "05:00", end: "12:00", adj: 10, note: "T2 morning transatlantic bank" },
    official: { shortHaul: 120, longHaul: 180, verified: true },
    routes: ["cta", "europe", "usPreclear", "longHaul"],
    transit: [{ name: "Dublin Airport: buses", url: "https://www.dublinairport.com/to-from-the-airport/by-bus/dublin-buses" }, { name: "Dublin Express", url: "https://www.dublinexpress.ie/" }, { name: "Aircoach", url: "https://www.aircoach.ie/" }] }
};

/* Official journey planners, by airport region. */
const PLANNERS = {
  tfl:      { name: "TfL Journey Planner", url: "https://tfl.gov.uk/plan-a-journey" },
  traveline:{ name: "Traveline", url: "https://www.traveline.info/" },
  scotland: { name: "Traveline Scotland", url: "https://www.travelinescotland.com/" },
  cymru:    { name: "Traveline Cymru", url: "https://www.traveline.cymru/" },
  translink:{ name: "Translink", url: "https://www.translink.co.uk/" },
  tfi:      { name: "Transport for Ireland", url: "https://www.transportforireland.ie/" },
  rail:     { name: "National Rail", url: "https://www.nationalrail.co.uk/" }
};
const REGION_PLANNER = {
  "London": "tfl", "England": "traveline", "Scotland": "scotland", "Scottish islands": "scotland",
  "Wales": "cymru", "Northern Ireland": "translink", "Ireland": "tfi"
};

/* Countries for the first picker, each with its regions in display order. */
const COUNTRIES = {
  GB: { name: "United Kingdom", regions: ["London", "England", "Scotland", "Scottish islands", "Wales", "Northern Ireland"] },
  IE: { name: "Ireland", regions: ["Ireland"] }
};
const REGION_COUNTRY = Object.fromEntries(
  Object.entries(COUNTRIES).flatMap(([c, v]) => v.regions.map(r => [r, c])));

/* Which piece of land a point is on, so "near you" only offers airports
   you can drive to. Coarse on purpose: the island of Ireland is a ~20-point
   outline (NI and the Republic are one landmass), and each island with an
   airport is a bounding box. Islands joined by bridge or causeway count as
   the mainland they connect to; islands without an airport here (Skye,
   Mull, Arran, Wight…) count as mainland GB, since people drive on after
   the ferry. The Isle of Man is listed so it isn't mistaken for GB. */
const IRELAND_OUTLINE = [ // [lon, lat]
  [-5.43, 54.48], [-5.95, 55.10], [-6.20, 55.25], [-7.25, 55.40], [-8.30, 55.20],
  [-8.60, 54.65], [-10.20, 54.25], [-10.30, 53.40], [-9.60, 52.60], [-10.50, 52.10],
  [-10.30, 51.60], [-9.80, 51.40], [-8.40, 51.60], [-6.90, 52.10], [-6.20, 52.15],
  [-5.95, 52.95], [-6.00, 53.50], [-6.05, 54.00], [-5.45, 54.25]
];
const ISLAND_BOXES = { // [minLat, maxLat, minLon, maxLon]
  scilly:   [49.85, 50.00, -6.45, -6.20],
  orkney:   [58.68, 59.40, -3.45, -2.35],
  shetland: [59.80, 60.90, -1.80, -0.70],
  lewis:    [57.70, 58.55, -7.15, -6.10],
  uist:     [57.05, 57.70, -7.60, -7.10],
  barra:    [56.90, 57.05, -7.60, -7.30],
  tiree:    [56.45, 56.56, -7.00, -6.70],
  islay:    [55.55, 55.95, -6.55, -6.00],
  man:      [54.04, 54.42, -4.85, -4.30]
};

function insidePolygon(lon, lat, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function landmassAt(lat, lon) {
  if (insidePolygon(lon, lat, IRELAND_OUTLINE)) return "ireland";
  for (const [name, [a, b, c, d]] of Object.entries(ISLAND_BOXES)) {
    if (lat >= a && lat <= b && lon >= c && lon <= d) return name;
  }
  return "gb";
}

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
    country: REGION_COUNTRY[a.region],
    landmass: a.landmass || (["Northern Ireland", "Ireland"].includes(a.region) ? "ireland" : "gb"),
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
