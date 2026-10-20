/* ============================================================
   SECTION 2 — THE MODEL (pure functions)
   ============================================================ */
const BASELINE = 60;        // Silver's default: doors to departure
const COMMUTE_FACTOR = 1.3; // Silver: "round up that commute time by 30 percent"

/* How you get there. Silver's +30% is for road traffic, so it applies to
   the car modes. Public transport runs to a timetable: its risk is a late
   or missed service, so it gets one-service-earlier padding instead.
   Our adaptation, not his. */
const TRAVEL_MODES = {
  lift:   { label: "Lift or taxi",      sub: "dropped at the door" },
  park:   { label: "Driving & parking", sub: "car park, maybe a shuttle bus" },
  public: { label: "Public transport",  sub: "train, bus, metro or tram" }
};

function travelExtra(i) {
  const airport = AIRPORTS[i.airport];
  if (i.travel === "park") {
    const mins = airport.tiny ? 5 : airport.sizeAdj <= 0 ? 10 : 20;
    return { label: airport.sizeAdj > 0 ? "Car park and shuttle bus" : "Parking and walking in", minutes: mins };
  }
  if (i.travel === "public") return { label: "One service earlier, in case of delays", minutes: 15 };
  return null;
}

function travelMinutes(i) {
  const extra = travelExtra(i);
  const base = i.travel === "public" ? i.commute : Math.round(i.commute * COMMUTE_FACTOR);
  return base + (extra ? extra.minutes : 0);
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function inPeak(peak, departHHMM) {
  if (!peak) return false;
  const t = toMinutes(departHHMM);
  return t >= toMinutes(peak.start) && t < toMinutes(peak.end);
}

/* Fast Track can only be chosen where it's sold (or where we don't know). */
function hasFastTrackChoice(airport) {
  return !airport.tiny && airport.fastTrack !== false;
}

/* "Least time at the airport": work back from the hard cut-offs instead
   of Silver's comfort margin. Typical airline times — people can override
   them with their own airline's. Security-and-walk minutes by size tier. */
const TIGHT = {
  gate: { short: 30, long: 45, usPreclear: 90 },
  bag: { short: 40, long: 60 },
  bagQueue: 10,
  securityWalk: { Tiny: 5, Small: 15, Medium: 20, Large: 30, "Very large": 35 }
};

function tightDefaults(i) {
  const route = ROUTES[i.route];
  return {
    gate: i.route === "usPreclear" ? TIGHT.gate.usPreclear : route.long ? TIGHT.gate.long : TIGHT.gate.short,
    bag: route.long ? TIGHT.bag.long : TIGHT.bag.short
  };
}

function computeTight(i) {
  const airport = AIRPORTS[i.airport];
  const security = hasFastTrackChoice(airport) ? i.security : "standard";
  const d = tightDefaults(i);
  const gate = i.gateClose || d.gate;
  const lines = [];
  const add = (label, minutes) => { if (minutes) lines.push({ label, minutes }); };
  const size = airport.sizeLabel.split(" — ")[0];

  lines.push({ label: i.route === "usPreclear"
      ? `US preclearance and gate close ${gate} min before departure`
      : `Gate closes ${gate} min before departure${i.gateClose ? "" : " (typical — check your airline)"}`,
    minutes: gate, base: true });
  add(`Security and walk to the gate — ${size.toLowerCase()} airport`, TIGHT.securityWalk[size]);
  if (security === "fast" && !airport.tiny) add("Fast Track security", -10);
  if (i.familiar) add("You know the shortcuts", -5);
  if (inPeak(airport.peak, i.time) && security !== "fast") add(`Longer queues: ${airport.peak.note}`, 10);
  if (i.conditions === "holiday") add("Holiday peak queues", security === "fast" ? 5 : 15);
  if (i.conditions === "storm") add("Severe weather", 10);

  // Bag drop comes before security, so its queue adds to the walk; and
  // you must reach the desk before it closes.
  if (i.bags === "checked") add("Bag drop queue", TIGHT.bagQueue);
  let total = lines.reduce((s, l) => s + l.minutes, 0);
  if (i.bags === "checked") {
    const bagClose = i.bagClose || d.bag;
    const need = bagClose + TIGHT.bagQueue;
    if (need > total) {
      add(`Bag drop closes ${bagClose} min before${i.bagClose ? "" : " (typical)"} — reach it with time to queue`, need - total);
      total = need;
    }
  }
  return { total, lines, tight: true };
}

/**
 * Returns { total, lines: [{label, minutes}] }.
 * `total` is minutes from walking through the terminal doors to departure.
 */
function computeBuffer(i) {
  if (i.strategy === "tight") return computeTight(i);
  const airport = AIRPORTS[i.airport];
  const route = ROUTES[i.route];
  const security = hasFastTrackChoice(airport) ? i.security : "standard";
  const lines = [];
  const add = (label, minutes) => { if (minutes) lines.push({ label, minutes }); };

  lines.push({ label: "Baseline — inside the terminal to departure", minutes: BASELINE, base: true });

  add(`${airport.full} — ${airport.sizeLabel.split(" — ")[0].toLowerCase()} airport`, airport.sizeAdj);
  if (i.familiar) add("You know this airport well", -5);

  // Island airports have one short queue for everyone; Silver's
  // no-PreCheck penalty only makes sense where queues are real.
  if (security === "standard" && !airport.tiny) {
    add(airport.fastTrack === false ? "Standard security queue (no Fast Track here)"
                                    : "Standard security queue (no Fast Track)", 20);
  }
  if (inPeak(airport.peak, i.time)) add(`Departing during the ${airport.peak.note}`, airport.peak.adj);

  add(route.label + " — " + route.sub, route.adj);
  if (i.bags === "checked") add("Bag drop / check-in desk", 20);

  if (i.conditions === "holiday") add("Holiday peak", security === "fast" ? 15 : 30);
  if (i.conditions === "storm") add("Severe weather", security === "fast" ? 10 : 20);

  if (i.connection) add("You have an onward connection", 10);
  if (i.highStakes) add("You genuinely cannot miss this one", 60);

  if (i.feeling === "love") add("You like being at airports", 20);
  if (i.feeling === "hate") add("You'd rather not linger", -5);

  const total = lines.reduce((s, l) => s + l.minutes, 0);
  return { total, lines };
}

function computePlan(i) {
  const buffer = computeBuffer(i);
  const commute = travelMinutes(i);
  const depart = new Date(`${i.date}T${i.time}`);
  const atTerminal = new Date(depart.getTime() - buffer.total * 60000);
  const leaveHome = new Date(atTerminal.getTime() - commute * 60000);
  return { buffer, commute, travelExtra: travelExtra(i), depart, atTerminal, leaveHome };
}

/* ============================================================
   SECTION 3 — CALENDAR EXPORT (.ics, RFC 5545)
   Times are written in UTC from the computed Dates, so they land
   correctly whatever zone the importing calendar is set to.
   ============================================================ */
function icsDate(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(s) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Lines longer than 75 octets must be folded: CRLF + one space.
function icsFold(line) {
  const enc = new TextEncoder();
  let out = "", bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > 75) { out += "\r\n "; bytes = 1; }
    out += ch;
    bytes += n;
  }
  return out;
}

function icsUid() {
  const rand = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  return `${rand}@airport-arrival-calculator`;
}

function breakdownText(p) {
  const rows = p.buffer.lines.map(l => {
    const sign = l.base ? "" : (l.minutes > 0 ? "+" : "-");
    return `${sign}${Math.abs(l.minutes)} min  ${l.label}`;
  });
  return rows.concat([
    "",
    `Time at the airport: ${fmtDuration(p.buffer.total)}`,
    `Travel there by ${TRAVEL_MODES[state.travel].label.toLowerCase()}: ${fmtDuration(p.commute)}`,
    `Total before departure: ${fmtDuration(p.buffer.total + p.commute)}`
  ]).concat(state.travel === "public"
    ? ["", `Public transport directions: ${transitUrl(AIRPORTS[state.airport])}`] : []).join("\n");
}

function flightLabel(i) {
  return i.flight.trim() ? ` ${i.flight.trim().toUpperCase()}` : "";
}

function buildICS(i, p) {
  const airport = AIRPORTS[i.airport];
  const stamp = icsDate(new Date());
  const location = `${airport.full} (${airport.code})`;
  const event = (fields, alarms) => [
    "BEGIN:VEVENT",
    `UID:${icsUid()}`,
    `DTSTAMP:${stamp}`,
    ...fields,
    ...alarms.flatMap(a => [
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(a.text)}`, `TRIGGER:${a.trigger}`, "END:VALARM"
    ]),
    "END:VEVENT"
  ];

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//airport-arrival-calculator//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...event([
      `DTSTART:${icsDate(p.leaveHome)}`,
      `DTEND:${icsDate(p.atTerminal)}`,
      `SUMMARY:${icsEscape(`Leave for ${airport.name} airport${flightLabel(i)}`)}`,
      `LOCATION:${icsEscape(location)}`,
      `DESCRIPTION:${icsEscape(
        `Be inside the terminal by ${fmtTime(p.atTerminal)}. Flight departs ${fmtTime(p.depart)}.\n\n` + breakdownText(p))}`
    ], [
      { trigger: "-PT15M", text: "Leave for the airport in 15 minutes" },
      { trigger: "PT0M", text: "Leave for the airport now" }
    ]),
    ...event([
      `DTSTART:${icsDate(p.depart)}`,
      `DTEND:${icsDate(new Date(p.depart.getTime() + 30 * 60000))}`,
      `SUMMARY:${icsEscape(`Flight${flightLabel(i)} departs ${airport.name}`)}`,
      `LOCATION:${icsEscape(location)}`
    ], [
      { trigger: "-PT1H", text: "Flight departs in 1 hour" }
    ]),
    "END:VCALENDAR"
  ];
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

function googleCalendarUrl(i, p) {
  const airport = AIRPORTS[i.airport];
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `Leave for ${airport.name} airport${flightLabel(i)}`,
    dates: `${icsDate(p.leaveHome)}/${icsDate(p.atTerminal)}`,
    location: `${airport.full} (${airport.code})`,
    details: `Be inside the terminal by ${fmtTime(p.atTerminal)}. Flight departs ${fmtTime(p.depart)}.\n\n` + breakdownText(p)
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

async function downloadICS() {
  const p = computePlan(state);
  const name = `flight-${state.date}-${state.airport}.ics`;
  const blob = new Blob([buildICS(state, p)], { type: "text/calendar;charset=utf-8" });

  // Installed on iOS, blob downloads go nowhere useful; the share sheet works.
  if (navigator.standalone && navigator.canShare) {
    const file = new File([blob], name, { type: "text/calendar" });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Airport plan" }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ============================================================
   SECTION 4 — STATE, RENDER, EVENTS
   ============================================================ */
const SAVED_KEYS = ["strategy", "country", "airport", "route", "travel", "commute", "security", "bags", "feeling", "familiar"];
const STORAGE_KEY = "airport-arrival-calculator:v1";

const state = {
  country: "GB",
  airport: "BFS",
  route: "uk",
  date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
  time: "07:00",
  flight: "",
  strategy: "silver",
  gateClose: null,
  bagClose: null,
  travel: "lift",
  commute: 30,
  security: "standard",
  bags: "hand",
  conditions: "normal",
  feeling: "neutral",
  familiar: false,
  connection: false,
  highStakes: false
};

// Remember the settings people rarely change between trips.
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  SAVED_KEYS.forEach(k => { if (k in saved) state[k] = saved[k]; });
  if (!AIRPORTS[state.airport]) state.airport = "BFS";
  if (!AIRPORTS[state.airport].routes.includes(state.route)) state.route = AIRPORTS[state.airport].routes[0];
} catch (e) { /* storage unavailable — defaults are fine */ }

state.country = AIRPORTS[state.airport].country;

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(SAVED_KEYS.map(k => [k, state[k]]))));
  } catch (e) { /* ignore */ }
}

const $ = id => document.getElementById(id);

// Minutes this choice would add or save compared with what's picked now.
function optionDelta(field, value) {
  const total = i => computeBuffer(i).total + travelMinutes(i);
  const alt = { ...state, [field]: value };
  // A location-based estimate changes with the mode, so compare like with like.
  if (field === "travel" && locationEstimate()) alt.commute = locationEstimate(value);
  return total(alt) - total(state);
}

function fmtDelta(d) {
  if (!d) return { text: "", cls: "" };
  return d > 0 ? { text: `+${d} min`, cls: "plus" } : { text: `−${-d} min`, cls: "minus" };
}

/* Option tiles. Buttons are updated in place while the set of options
   stays the same, so selection changes animate instead of re-rendering. */
function tiles(el, items, check) {
  const keys = items.map(o => o.id).join("|");
  if (el.dataset.keys !== keys) {
    el.dataset.keys = keys;
    el.innerHTML = "";
    items.forEach(o => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tile";
      b.innerHTML = `<span class="t"><span class="label"></span>${o.sub ? '<span class="hint"></span>' : ""}</span>` +
                    `<span class="end"><span class="delta"></span>${check ? '<span class="check" aria-hidden="true"></span>' : ""}</span>`;
      el.appendChild(b);
    });
  }
  items.forEach((o, n) => {
    const b = el.children[n];
    b.onclick = () => { o.pick(); render(); };
    b.setAttribute("aria-pressed", String(o.selected));
    b.querySelector(".label").textContent = o.label;
    if (o.sub) b.querySelector(".hint").textContent = o.sub;
    const d = fmtDelta(o.delta);
    const delta = b.querySelector(".delta");
    delta.textContent = d.text;
    delta.className = `delta ${d.cls}`;
  });
}

function segment(el, field, options) {
  tiles(el, options.map(o => ({
    id: o.key, label: o.label, sub: o.sub,
    selected: o.key === state[field],
    delta: optionDelta(field, o.key),
    pick: () => {
      state[field] = o.key;
      if (field === "travel" && locationEstimate()) applyDriveEstimate();
    }
  })), false);
}

function toggles(el, items) {
  tiles(el, items.map(o => ({
    id: o.key, label: o.label, sub: o.sub,
    selected: !!state[o.key],
    delta: optionDelta(o.key, !state[o.key]),
    pick: () => { state[o.key] = !state[o.key]; }
  })), true);
}

// Set text and replay the tick animation only when it actually changes.
function setText(el, text) {
  if (el.textContent === text) return;
  el.textContent = text;
  el.classList.remove("tick");
  void el.offsetWidth;
  el.classList.add("tick");
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDayOffset(target, reference) {
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const b = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const days = Math.round((a - b) / 86400000);
  if (days === 0) return "";
  if (days === -1) return " the day before";
  return ` ${target.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}`;
}

function fmtDuration(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${m.toString().padStart(2, "0")}` : `${h}h`;
}

function fastTrackText(ft) {
  if (ft === true) return "Available to buy";
  if (ft === "premium") return "Premium cabin / airline status only";
  if (ft === false) return "Not available";
  return "Not confirmed — check the airport's site";
}

/* Country picker is built once; the airport list is rebuilt when the
   country changes, grouped by region. */
function buildCountryPicker() {
  const sel = $("country");
  Object.entries(COUNTRIES).forEach(([code, c]) => {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = c.name;
    sel.appendChild(o);
  });
  sel.onchange = e => {
    const first = Object.values(AIRPORTS).find(a => a.country === e.target.value);
    chooseAirport(first.code);
  };
  $("apt").onchange = e => chooseAirport(e.target.value);
}

let builtFor = null;
function buildAirportPicker() {
  if (builtFor === state.country) return;
  builtFor = state.country;
  const sel = $("apt");
  sel.innerHTML = "";
  COUNTRIES[state.country].regions.forEach(region => {
    const list = Object.values(AIRPORTS).filter(a => a.region === region);
    if (!list.length) return;
    const group = document.createElement("optgroup");
    group.label = region;
    list.forEach(a => {
      const o = document.createElement("option");
      o.value = a.code;
      o.textContent = `${a.name} (${a.code})`;
      group.appendChild(o);
    });
    sel.appendChild(group);
  });
}

function chooseAirport(code) {
  state.airport = code;
  state.country = AIRPORTS[code].country;
  if (!AIRPORTS[code].routes.includes(state.route)) state.route = AIRPORTS[code].routes[0];
  if (position) applyDriveEstimate();
  render();
}

/* ============================================================
   LOCATION — "airports you can drive to"
   The position stays in memory on this device; it is never sent
   anywhere or saved.
   ============================================================ */
const MAX_REACH_KM = 250;
let position = null;   // { lat, lon, landmass }
let commuteFromLocation = false;

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = d => d * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// Free-flowing estimate from straight-line distance; the model adds its
// 30% for traffic on top, so this deliberately doesn't.
function estimateDriveMin(km, airport) {
  const long = km >= 80;               // mostly motorway / dual carriageway
  const road = km * (airport && airport.roadFactor || (long ? 1.25 : 1.35));
  const speed = km < 10 ? 30 : km < 40 ? 50 : long ? 90 : 70;
  return Math.max(5, Math.round((10 + road / speed * 60) / 5) * 5);
}

// Public transport: slower than the car and with waits, faster where a
// train or tram stops at the terminal.
function estimateTravelMin(km, airport, mode) {
  const car = estimateDriveMin(km, airport);
  if (mode !== "public") return car;
  // Long trips are mostly an express coach or train at road speed; short
  // ones are slower local services. Plus getting to the stop and waiting.
  const mins = km >= 80 ? car * 1.1 + 20 : car * (airport.rail ? 1.1 : 1.4) + 10;
  return Math.round(mins / 5) * 5;
}

function transitUrl(airport) {
  const q = new URLSearchParams({ api: "1", destination: airport.full, travelmode: "transit" });
  if (position) q.set("origin", `${position.lat.toFixed(4)},${position.lon.toFixed(4)}`);
  return `https://www.google.com/maps/dir/?${q}`;
}

function renderJourneyLinks() {
  const card = $("journey");
  card.hidden = state.travel !== "public";
  if (card.hidden) return;
  const a = AIRPORTS[state.airport];
  const links = [{ name: "Google Maps — public transport directions", url: transitUrl(a) }];
  links.push(PLANNERS[REGION_PLANNER[a.region]]);
  // Cross-border trips on the island of Ireland use both networks.
  if (a.landmass === "ireland") links.push(PLANNERS[a.country === "IE" ? "translink" : "tfi"]);
  if (a.rail && a.country === "GB") links.push(PLANNERS.rail);
  (a.transit || []).forEach(t => links.push(t));
  $("journeyLinks").innerHTML = links.map(l =>
    `<li><a href="${l.url}" target="_blank" rel="noopener">${l.name}</a></li>`).join("");
  $("journeyNote").textContent = position
    ? "The Google Maps link starts from your location, so opening it shares that with Google."
    : "";
}

function modeWord(mode) {
  return mode === "public" ? "by public transport" : "drive";
}

function reachableAirports() {
  return Object.values(AIRPORTS)
    .filter(a => a.landmass === position.landmass)
    .map(a => {
      const km = distanceKm(position.lat, position.lon, a.lat, a.lon);
      return { airport: a, km, minutes: estimateTravelMin(km, a, state.travel) };
    })
    .sort((x, y) => x.minutes - y.minutes || x.km - y.km);
}

function setLocStatus(text, warn) {
  $("locStatus").textContent = text;
  $("locStatus").classList.toggle("warn", !!warn);
}

// Estimated door-to-door minutes from the known position to the chosen
// airport, or null when there's no position, no estimate in use, or no road.
function locationEstimate(mode = state.travel) {
  if (!position || !commuteFromLocation) return null;
  const a = AIRPORTS[state.airport];
  if (a.landmass !== position.landmass) return null;
  return estimateTravelMin(distanceKm(position.lat, position.lon, a.lat, a.lon), a, mode);
}

// Use the travel estimate for the chosen airport, if it's reachable by road.
function applyDriveEstimate() {
  const a = AIRPORTS[state.airport];
  if (a.landmass !== position.landmass) {
    setLocStatus(`${a.name} isn't reachable by road from where you are.`, true);
    return;
  }
  const km = distanceKm(position.lat, position.lon, a.lat, a.lon);
  state.commute = estimateTravelMin(km, a, state.travel);
  $("commute").value = state.commute;
  commuteFromLocation = true;
  setLocStatus(`${a.name} is about ${Math.round(km)} km away.`);
}

function renderNearby() {
  const el = $("nearby");
  if (!position) { el.hidden = true; return; }
  const near = reachableAirports().filter(r => r.km <= MAX_REACH_KM).slice(0, 4);
  el.hidden = !near.length;
  if (!near.length) return;
  tiles(el, near.map(r => ({
    id: r.airport.code,
    label: `${r.airport.name} (${r.airport.code})`,
    sub: `${Math.round(r.km)} km · ~${r.minutes} min ${modeWord(state.travel)}`,
    selected: r.airport.code === state.airport,
    delta: 0,
    pick: () => chooseAirport(r.airport.code)
  })), false);
}

function locate() {
  if (!("geolocation" in navigator)) { setLocStatus("This device can't share its location.", true); return; }
  setLocStatus("Finding you…");
  $("locate").disabled = true;
  navigator.geolocation.getCurrentPosition(pos => {
    $("locate").disabled = false;
    const { latitude: lat, longitude: lon } = pos.coords;
    position = { lat, lon, landmass: landmassAt(lat, lon) };
    const near = reachableAirports();
    if (!near.length) {
      setLocStatus("There's no airport in this app on your island.", true);
    } else if (near[0].km > MAX_REACH_KM) {
      position = null;
      setLocStatus("You're outside the area this app covers (UK and Ireland).", true);
    } else {
      chooseAirport(near[0].airport.code);
      setLocStatus(`Quickest to reach by road: ${near[0].airport.name}, about ${Math.round(near[0].km)} km away.`);
      return;
    }
    render();
  }, err => {
    $("locate").disabled = false;
    setLocStatus(err.code === err.PERMISSION_DENIED
      ? "Location is turned off for this site — pick your airport below."
      : "Couldn't get your location — pick your airport below.", true);
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}

let shownAirport = null;

function render() {
  const airport = AIRPORTS[state.airport];
  buildAirportPicker();
  $("country").value = state.country;
  $("apt").value = state.airport;
  renderNearby();
  $("commuteHelp").textContent = state.travel === "public"
    ? (commuteFromLocation ? "Estimated from your location. " : "") +
      "Look up the journey below and enter the door-to-door time. No traffic padding is added — just 15 min for one service earlier."
    : commuteFromLocation
      ? "Estimated from your location — change it if you know better. The model adds 30% for traffic."
      : "Your honest estimate — the model adds 30% for traffic, as Silver recommends.";
  renderJourneyLinks();

  // airport info, faded in when the airport changes
  if (shownAirport !== state.airport) {
    shownAirport = state.airport;
    $("aptInfo").classList.remove("fade");
    void $("aptInfo").offsetWidth;
    $("aptInfo").classList.add("fade");
  }
  $("aptInfo").innerHTML = `
    <div class="size">${airport.sizeLabel}</div>
    <dl>
      <dt>Passengers</dt><dd>${airport.paxPerYear} a year</dd>
      <dt>Layout</dt><dd>${airport.terminals}</dd>
      <dt>Location</dt><dd>${airport.distance}</dd>
      <dt>Fast Track</dt><dd>${fastTrackText(airport.fastTrack)}</dd>
    </dl>`;

  // route options for this airport
  segment($("route"), "route", airport.routes.map(k => ({ key: k, label: ROUTES[k].label, sub: ROUTES[k].sub })));

  $("securityField").hidden = !hasFastTrackChoice(airport);
  segment($("security"), "security", [
    { key: "fast", label: airport.fastTrack === "premium" ? "Fast Track (premium / status)" : "Fast Track" },
    { key: "standard", label: "Standard" }
  ]);

  segment($("strategy"), "strategy", [
    { key: "silver", label: "Recommended", sub: "Silver's model — a comfortable margin" },
    { key: "tight", label: "Least time at the airport", sub: "work back from the gate and bag-drop cut-offs" }
  ]);
  $("tightFields").hidden = state.strategy !== "tight";
  const td = tightDefaults(state);
  $("gateClose").placeholder = td.gate;
  $("bagClose").placeholder = td.bag;
  $("bagCloseField").hidden = state.bags !== "checked";

  segment($("travel"), "travel", Object.entries(TRAVEL_MODES).map(([key, m]) => ({ key, label: m.label, sub: m.sub })));

  segment($("bags"), "bags", [
    { key: "hand", label: "Hand luggage" },
    { key: "checked", label: "Checking a bag" }
  ]);

  segment($("conditions"), "conditions", [
    { key: "normal", label: "Normal" },
    { key: "holiday", label: "Holiday peak" },
    { key: "storm", label: "Bad weather" }
  ]);

  segment($("feeling"), "feeling", [
    { key: "love", label: "Love them" },
    { key: "neutral", label: "Neutral" },
    { key: "hate", label: "Hate them" }
  ]);

  toggles($("flags"), [
    { key: "familiar", label: "I fly from here often", sub: "You know the car park and the shortcuts" },
    { key: "connection", label: "I have an onward connection", sub: "Missing this one costs you the next one too" },
    { key: "highStakes", label: "I really cannot miss this flight", sub: "A wedding, or the only flight today" }
  ]);

  // ---- results ----
  const valid = state.date && state.time;
  $("addCal").disabled = $("addCal2").disabled = !valid;
  if (!valid) return;
  const p = computePlan(state);

  const leave = fmtTime(p.leaveHome) + fmtDayOffset(p.leaveHome, p.depart);
  const inside = `${fmtTime(p.atTerminal)}${fmtDayOffset(p.atTerminal, p.depart)}`;
  setText($("leaveTime"), leave);
  setText($("barTime"), leave);
  const tight = state.strategy === "tight";
  $("terminalTime").textContent = `${tight ? "Cutting it fine · " : ""}Inside the terminal by ${inside} · flight at ${fmtTime(p.depart)}`;
  $("barSub").textContent = `${tight ? "Tight · " : ""}Inside by ${inside} · flight ${fmtTime(p.depart)}`;
  $("panelTotals").innerHTML = `
    <dt>Time at the airport</dt><dd>${fmtDuration(p.buffer.total)}</dd>
    <dt>Travel there (${state.commute}${state.travel === "public" ? "" : " + 30%"}${p.travelExtra ? ` + ${p.travelExtra.minutes}` : ""})</dt><dd>${fmtDuration(p.commute)}</dd>
    <dt>Total before departure</dt><dd>${fmtDuration(p.buffer.total + p.commute)}</dd>`;

  $("gcal").href = $("gcal2").href = googleCalendarUrl(state, p);

  const rows = p.buffer.lines.map(l => {
    const cls = l.base ? "base" : (l.minutes > 0 ? "plus" : "minus");
    const sign = l.base ? "" : (l.minutes > 0 ? "+" : "−");
    return `<tr><td>${l.label}</td><td class="n ${cls}">${sign}${Math.abs(l.minutes)} min</td></tr>`;
  }).join("");

  $("breakdown").innerHTML = rows + `
    <tr class="total"><td>Time at the airport</td><td class="n">${fmtDuration(p.buffer.total)}</td></tr>
    <tr class="total"><td>Travel there — ${TRAVEL_MODES[state.travel].label.toLowerCase()} (${[
      state.travel === "public" ? `${state.commute} min` : `${state.commute} min + 30%`,
      p.travelExtra ? `${p.travelExtra.label.toLowerCase()}: ${p.travelExtra.minutes} min` : ""
    ].filter(Boolean).join(", plus ")})</td><td class="n">${fmtDuration(p.commute)}</td></tr>
    <tr class="total"><td>Total before departure</td><td class="n">${fmtDuration(p.buffer.total + p.commute)}</td></tr>`;

  // official comparison
  const isLong = ROUTES[state.route].long;
  const advice = isLong ? (airport.official.longHaul || airport.official.shortHaul) : airport.official.shortHaul;
  const diff = p.buffer.total - advice;
  const verb = Math.abs(diff) <= 10 ? "lands about the same"
             : diff > 0 ? `is ${fmtDuration(diff)} more cautious`
             : `is ${fmtDuration(-diff)} tighter`;
  const official =
    `<strong>${airport.full}</strong> ${airport.official.verified ? "advises" : "is generally said to want"} ` +
    `<strong>${fmtDuration(advice)}</strong> before ${isLong ? "a long-haul" : "a short-haul"} flight.`;
  if (tight) {
    const recommended = computeBuffer({ ...state, strategy: "silver" }).total;
    const risks = [state.highStakes && "you said you can't miss this flight",
                   state.connection && "you have an onward connection"].filter(Boolean);
    $("official").innerHTML =
      `<strong>Cutting it fine:</strong> ${fmtDuration(p.buffer.total)} at the airport, ` +
      `${fmtDuration(recommended - p.buffer.total)} less than the recommended plan. ` +
      `There's no slack: one slow queue or a late bus and you miss the gate. ` +
      `Check your airline's actual gate and bag-drop times and enter them above. ` + official +
      (risks.length ? ` <strong>Not a good idea here — ${risks.join(" and ")}.</strong>` : "");
  } else {
    $("official").innerHTML = official +
      ` This model says <strong>${fmtDuration(p.buffer.total)}</strong> — it ${verb}.` +
      (airport.official.verified ? "" : " (Not confirmed against the airport's own guidance.)");
  }

  save();
}

// plain inputs
$("date").value = state.date;
$("date").oninput = e => { state.date = e.target.value; render(); };
$("time").oninput = e => { state.time = e.target.value; render(); };
$("flight").oninput = e => { state.flight = e.target.value; render(); };
$("commute").value = state.commute;
$("commute").oninput = e => { state.commute = Math.max(0, Number(e.target.value) || 0); commuteFromLocation = false; render(); };
$("locate").onclick = locate;
["gateClose", "bagClose"].forEach(id => {
  $(id).value = state[id] || "";
  $(id).oninput = e => { const v = Number(e.target.value); state[id] = v > 0 ? Math.min(v, 240) : null; render(); };
});
$("addCal").onclick = $("addCal2").onclick = downloadICS;
$("bar").onclick = () => $("plan").scrollIntoView({ behavior: "smooth", block: "start" });

buildCountryPicker();
render();

// Sections rise into view as you scroll. Skipped when motion is reduced.
if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.classList.add("reveal");
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".step").forEach(el => io.observe(el));
}

/* ============================================================
   SECTION 5 — INSTALL AS AN APP
   ============================================================ */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => { /* offline support is a bonus */ });
}

const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let installPrompt = null;

function dismissInstall() {
  $("install").hidden = true;
  try { localStorage.setItem(STORAGE_KEY + ":installDismissed", "1"); } catch (e) { /* ignore */ }
}

function installDismissed() {
  try { return localStorage.getItem(STORAGE_KEY + ":installDismissed") === "1"; } catch (e) { return false; }
}

// Android / desktop Chrome: offer the real install prompt.
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installPrompt = e;
  if (installDismissed()) return;
  $("installText").textContent = "Install this on your phone — it works offline at the airport.";
  $("installBtn").hidden = false;
  $("install").hidden = false;
});

$("installBtn").onclick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("install").hidden = true;
};
$("installClose").onclick = dismissInstall;
window.addEventListener("appinstalled", () => { $("install").hidden = true; });

// iOS Safari has no prompt; tell people where the option lives.
if (isIOS && !isStandalone && !installDismissed()) {
  $("installText").innerHTML = "Install: tap <strong>Share</strong> then <strong>Add to Home Screen</strong>. Works offline.";
  $("install").hidden = false;
}
