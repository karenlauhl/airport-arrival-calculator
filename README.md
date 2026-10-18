# When should I leave for the airport?

Nate Silver's [arrival-time model](https://www.natesilver.net/p/how-soon-should-you-arrive-at-the-airport),
calibrated for every UK airport with scheduled passenger flights, plus Dublin.

- Installs to your phone's home screen (PWA) and works offline after the first visit.
- Exports a calendar entry: a `.ics` download (Apple Calendar, Outlook, etc.) or a Google Calendar link.

No build step: plain HTML, CSS and JavaScript.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page and styles |
| `airports.js` | Airport and route data, plus the size-tier rule |
| `app.js` | The model, calendar export, rendering, install prompt |
| `sw.js` | Offline cache |
| `manifest.webmanifest`, `icons/` | What makes it installable |

## Adding an airport

Add one entry to `RAW_AIRPORTS` in `airports.js`. Nothing else needs to change.
The size adjustment comes from `pax` automatically. Then bump `CACHE_VERSION` in `sw.js`.

## Releasing a change

Bump `CACHE_VERSION` in `sw.js` whenever any file changes, or installed copies keep serving the old version.

## Hosting (GitHub Pages)

Settings → Pages → Source: *Deploy from a branch* → pick the branch and `/ (root)`.
The site appears at `https://<user>.github.io/airport-arrival-calculator/`.
Installing as an app only works over HTTPS, which Pages provides.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
