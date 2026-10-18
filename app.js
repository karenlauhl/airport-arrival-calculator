/* ============================================================
   SECTION 2 — THE MODEL (pure functions)
   ============================================================ */
const BASELINE = 60;        // Silver's default: doors to departure
const COMMUTE_FACTOR = 1.3; // Silver: "round up that commute time by 30 percent"

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

/**
 * Returns { total, lines: [{label, minutes}] }.
 * `total` is minutes from walking through the terminal doors to departure.
 */
function computeBuffer(i) {
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
  const commute = Math.round(i.commute * COMMUTE_FACTOR);
  const depart = new Date(`${i.date}T${i.time}`);
  const atTerminal = new Date(depart.getTime() - buffer.total * 60000);
  const leaveHome = new Date(atTerminal.getTime() - commute * 60000);
  return { buffer, commute, depart, atTerminal, leaveHome };
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
    `Travel there (+30%): ${fmtDuration(p.commute)}`,
    `Total before departure: ${fmtDuration(p.buffer.total + p.commute)}`
  ]).join("\n");
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
const SAVED_KEYS = ["airport", "route", "commute", "security", "bags", "feeling", "familiar"];
const STORAGE_KEY = "airport-arrival-calculator:v1";

const state = {
  airport: "BFS",
  route: "uk",
  date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
  time: "07:00",
  flight: "",
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

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(SAVED_KEYS.map(k => [k, state[k]]))));
  } catch (e) { /* ignore */ }
}

const $ = id => document.getElementById(id);

function segment(el, options, selectedKey, onPick) {
  el.innerHTML = "";
  options.forEach(o => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-pressed", String(o.key === selectedKey));
    b.innerHTML = o.sub
      ? `${o.label}<span class="hint">${o.sub}</span>`
      : o.label;
    b.onclick = () => { onPick(o.key); render(); };
    el.appendChild(b);
  });
}

function toggles(el, items) {
  el.innerHTML = "";
  items.forEach(o => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-pressed", String(!!state[o.key]));
    b.innerHTML = `${state[o.key] ? "✓ " : ""}${o.label}<span class="hint">${o.sub}</span>`;
    b.onclick = () => { state[o.key] = !state[o.key]; render(); };
    el.appendChild(b);
  });
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

// The picker is built once; render() only keeps its value in sync.
function buildAirportPicker() {
  const sel = $("apt");
  REGIONS.forEach(region => {
    const group = document.createElement("optgroup");
    group.label = region;
    Object.values(AIRPORTS).filter(a => a.region === region).forEach(a => {
      const o = document.createElement("option");
      o.value = a.code;
      o.textContent = `${a.name} (${a.code})`;
      group.appendChild(o);
    });
    sel.appendChild(group);
  });
  sel.onchange = e => {
    state.airport = e.target.value;
    if (!AIRPORTS[state.airport].routes.includes(state.route)) state.route = AIRPORTS[state.airport].routes[0];
    render();
  };
}

function render() {
  const airport = AIRPORTS[state.airport];
  $("apt").value = state.airport;

  // airport info card
  $("aptInfo").innerHTML = `
    <div class="size">${airport.sizeLabel}</div>
    <dl>
      <dt>Passengers</dt><dd>${airport.paxPerYear} a year</dd>
      <dt>Layout</dt><dd>${airport.terminals}</dd>
      <dt>Location</dt><dd>${airport.distance}</dd>
      <dt>Fast Track</dt><dd>${fastTrackText(airport.fastTrack)}</dd>
    </dl>`;

  // route options for this airport
  segment($("route"), airport.routes.map(k => ({ key: k, label: ROUTES[k].label, sub: ROUTES[k].sub })),
    state.route, k => state.route = k);

  $("securityField").hidden = !hasFastTrackChoice(airport);
  segment($("security"), [
    { key: "fast", label: airport.fastTrack === "premium" ? "Fast Track (premium / status)" : "Fast Track" },
    { key: "standard", label: "Standard" }
  ], state.security, k => state.security = k);

  segment($("bags"), [
    { key: "hand", label: "Hand luggage" },
    { key: "checked", label: "Checking a bag" }
  ], state.bags, k => state.bags = k);

  segment($("conditions"), [
    { key: "normal", label: "Normal" },
    { key: "holiday", label: "Holiday peak" },
    { key: "storm", label: "Bad weather" }
  ], state.conditions, k => state.conditions = k);

  segment($("feeling"), [
    { key: "love", label: "Love them" },
    { key: "neutral", label: "Neutral" },
    { key: "hate", label: "Hate them" }
  ], state.feeling, k => state.feeling = k);

  toggles($("flags"), [
    { key: "familiar", label: "I fly from here often", sub: "You know the car park and the shortcuts" },
    { key: "connection", label: "I have an onward connection", sub: "Missing this one costs you the next one too" },
    { key: "highStakes", label: "I really cannot miss this flight", sub: "A wedding, or the only flight today" }
  ]);

  // ---- results ----
  const valid = state.date && state.time;
  $("addCal").disabled = !valid;
  if (!valid) return;
  const p = computePlan(state);

  $("leaveTime").textContent = fmtTime(p.leaveHome) + fmtDayOffset(p.leaveHome, p.depart);
  $("terminalTime").textContent =
    `Inside the terminal by ${fmtTime(p.atTerminal)}${fmtDayOffset(p.atTerminal, p.depart)} · ` +
    `${p.commute} min travel (${state.commute} + 30%)`;

  $("gcal").href = googleCalendarUrl(state, p);

  const rows = p.buffer.lines.map(l => {
    const cls = l.base ? "base" : (l.minutes > 0 ? "plus" : "minus");
    const sign = l.base ? "" : (l.minutes > 0 ? "+" : "−");
    return `<tr><td>${l.label}</td><td class="n ${cls}">${sign}${Math.abs(l.minutes)} min</td></tr>`;
  }).join("");

  $("breakdown").innerHTML = rows + `
    <tr class="total"><td>Time at the airport</td><td class="n">${fmtDuration(p.buffer.total)}</td></tr>
    <tr class="total"><td>Travel there (+30%)</td><td class="n">${fmtDuration(p.commute)}</td></tr>
    <tr class="total"><td>Total before departure</td><td class="n">${fmtDuration(p.buffer.total + p.commute)}</td></tr>`;

  // official comparison
  const isLong = ROUTES[state.route].long;
  const advice = isLong ? (airport.official.longHaul || airport.official.shortHaul) : airport.official.shortHaul;
  const diff = p.buffer.total - advice;
  const verb = Math.abs(diff) <= 10 ? "lands about the same"
             : diff > 0 ? `is ${fmtDuration(diff)} more cautious`
             : `is ${fmtDuration(-diff)} tighter`;
  $("official").innerHTML =
    `<strong>${airport.full}</strong> ${airport.official.verified ? "advises" : "is generally said to want"} ` +
    `<strong>${fmtDuration(advice)}</strong> before ${isLong ? "a long-haul" : "a short-haul"} flight. ` +
    `This model says <strong>${fmtDuration(p.buffer.total)}</strong> — it ${verb}.` +
    (airport.official.verified ? "" : " (Not confirmed against the airport's own guidance.)");

  save();
}

// plain inputs
$("date").value = state.date;
$("date").oninput = e => { state.date = e.target.value; render(); };
$("time").oninput = e => { state.time = e.target.value; render(); };
$("flight").oninput = e => { state.flight = e.target.value; render(); };
$("commute").value = state.commute;
$("commute").oninput = e => { state.commute = Math.max(0, Number(e.target.value) || 0); render(); };
$("addCal").onclick = downloadICS;

buildAirportPicker();
render();

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
