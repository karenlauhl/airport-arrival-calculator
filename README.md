# airport-arrival-calculator

Tells you when to leave home for your flight, and shows its working.

Answer a few questions about your trip — which airport, where you're going, bags, Fast Track,
how long the drive is — and it gives you a "leave home at" time plus a line-by-line breakdown of
every minute it budgeted and why.

Currently covers **Belfast City (BHD)**, **Belfast International (BFS)** and **Dublin (DUB)**.

## Running it

Open `index.html` in a browser. That's it — no build step, no dependencies, no server.
It's a single self-contained file, so it also deploys to GitHub Pages as-is.

## Where the model comes from

The framework is Nate Silver's
[How soon should you arrive at the airport?](https://www.natesilver.net/p/how-soon-should-you-arrive-at-the-airport):
a 60-minute baseline from walking through the terminal doors to departure, plus signed adjustments
for airport size, security type, bags and so on, with your commute estimate rounded up 30%.

**The numbers have been adapted, and that matters.** Silver calibrated his model for US airports —
TSA PreCheck, US domestic flights, JFK/DFW/O'Hare as the "busy" tier. None of that transfers to
Belfast or Dublin. So while the arithmetic is his, the adjustment categories here are local:

| Silver's category | What's used here |
|---|---|
| TSA PreCheck | Paid Fast Track (all three airports sell it) |
| US domestic | Great Britain domestic, and Common Travel Area — neither needs immigration |
| International +20–40 | Europe short-haul +10, long-haul +25 |
| *(no equivalent)* | **US preclearance from Dublin +60** — you clear US immigration before boarding |

The Dublin→US case is the one worth knowing about: full US preclearance means Dublin Airport asks
for **3 hours**, and Silver's unmodified 60-minute baseline would leave you badly short. The model
lands at 3h05 for that trip, which is the main check that the adaptation is calibrated sensibly.

Each airport's own official advice is shown next to the model's answer, so you can see where they
disagree and decide who to trust.

## Adding an airport

Everything is driven by the `AIRPORTS` object at the top of the `<script>` block in `index.html`.
Add one entry and the picker, info card and route options all pick it up — no other changes needed:

```js
CORK: {
  name: "Cork",                       // short label on the picker button
  full: "Cork Airport",
  sizeAdj: -5,                        // minutes: Silver's +15 busy / 0 mid / -5 regional
  sizeLabel: "Small — regional",
  paxPerYear: "~3 million",
  terminals: "Single terminal",
  fastTrack: true,
  distance: "~8 km from Cork city centre",
  peak: { start: "05:00", end: "08:00", adj: 10, note: "early departure bank" },
  official: { shortHaul: 120, longHaul: 180, verified: false },
  routes: ["uk", "cta", "europe"]     // keys from the ROUTES object
}
```

Set `official.verified` to `false` where the arrival-time advice hasn't been confirmed against the
airport's own published guidance — the app labels those differently rather than overstating them.

## Caveats

It's a planning aid, not a guarantee. Silver reports missing about 0.5% of 800 flights using this
approach — and mostly by misjudging the drive, not the time inside the terminal. The 30% commute
padding is doing more work than any other number in the model.
