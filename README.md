# Barzok People Map | مردمنگار برزک

A living map of memory, culture and everyday life in Barzok (Kashan, Isfahan, Iran).

**Current mode: prototype with zero external accounts.** No Google Cloud project, no billing, no API keys,
no Supabase, no Gemini. The map is Leaflet + OpenStreetMap, the data is local JSON, and edits are kept in the
browser's `localStorage`.

## Run

```bash
npm install
npm run dev      # http://localhost:3000  (this is also what AI Studio Preview runs)
npm run build    # static site in dist/
npm run lint     # type check
```

No `.env` file is needed.

## What changed from the Google/Cloud version

| Area | Before | Now |
|---|---|---|
| Map | `@vis.gl/react-google-maps` + unofficial Google tiles | `react-leaflet` + OpenStreetMap tiles (`src/components/map/`) |
| Data | Express + PostgreSQL (Cloud SQL) via `server.ts`, `src/db` | JSON seed `src/data/seed/*.json` + localStorage (`src/data/localBackend.ts`) |
| Auth | Firebase Auth + firebase-admin | Local demo admin session (`src/context/AuthContext.tsx`) — **not real security** |
| Gemini | requested in `metadata.json` | removed |

The old backend files (`server.ts`, `src/db/`, `src/middleware/`, `src/lib/firebase*.ts`) are still in the
repo but are no longer built or type-checked. The original Google Maps canvas and Firebase auth provider are
archived in `docs/future-google-maps/` (`.txt` so they are not compiled).

## Architecture (kept modular on purpose)

```
src/
  components/
    BarzokMapCanvas.tsx        facade the app uses; picks the map implementation
    map/LeafletMapCanvas.tsx   Leaflet implementation (markers, route, pick-a-point, layer styles)
    map/mapTypes.ts            props contract every map implementation must satisfy
  data/
    api.ts                     apiRequest(method, path, body): local backend or remote fetch
    localBackend.ts            same /api/... routes the old Express server had, in the browser
    seed/*.json                demo layers, places, people, stories, events, routes, contributions
  context/AuthContext.tsx      demo admin session
```

- **Dynamic layers, markers, category filters, detail panel, stories, people, routes, moderation queue,
  community contributions** all work as before; only the data source and map engine changed.
- Demo records are clearly labelled as demo data. Edit them in `/admin` (demo sign-in) or in
  `src/data/seed/`. The admin header has **Reset demo data**, which clears this browser's edits.
- Map centre is **33.78583° N, 51.22722° E** (Wikipedia: 33°47′09″N 51°13′38″E; a second gazetteer lists
  ≈33.783, 51.225). The seed place coordinates are illustrative demo points placed around that centre.

### Limits of local mode

- Data is stored per browser. Visitors do not see each other's edits or contributions, and clearing site data
  resets everything. This is fine for a demo, **not** for publishing real community content.
- There is no real admin authentication.
- OSM's public tile servers are meant for light use. Keep the attribution, and use a hosted tile provider or
  your own tile server before heavy public traffic
  (<https://operations.osmfoundation.org/policies/tiles/>).
- The previous "satellite" layer used unofficial Google tiles and was dropped. Available styles are the OSM
  street map and OpenTopoMap terrain.

## Embedding in WordPress / Elementor

1. Deploy the built site (`npm run build`, upload `dist/`) to any static host (Netlify, Cloudflare Pages,
   GitHub Pages, your own server). `public/_headers` and `public/_redirects` are already set up for Netlify and
   Cloudflare Pages.
2. In Elementor add an **HTML** widget and paste:

```html
<iframe
  src="https://YOUR-SITE.example/?embed=1"
  width="100%" height="680"
  style="border:0; border-radius:12px; overflow:hidden;"
  allowfullscreen loading="lazy"
  title="مردمنگار برزک | Barzok People Map"></iframe>
```

3. English UI: use `?embed=1&lang=en`. Persian is the default.
4. The host must not send `X-Frame-Options: DENY/SAMEORIGIN` or a CSP that omits your WordPress domain in
   `frame-ancestors`. The included `_headers` file sends `frame-ancestors *`; restrict it to your domain when
   you go live (`frame-ancestors https://your-wordpress-site.example`).
5. The `/admin` route is hidden in embed mode.

`/embed` (path) still works where the host rewrites unknown paths to `index.html`; `?embed=1` works everywhere.

## Adding Supabase (or another backend) later

The UI talks to data only through `apiRequest()` in `src/data/api.ts`, using the same URLs and JSON shapes as
the old Express server. Two ways in:

- Put a backend that implements those `/api/...` routes behind `VITE_API_BASE_URL` and set
  `VITE_DATA_SOURCE=remote`.
- Or add a Supabase adapter next to `localBackend.ts` and select it in `api.ts`. Replace
  `AuthContext.tsx` with real sign-in and pass its token via the `token` option.

`src/db/schema.ts` still documents the relational model.

## Adding Google Maps later

Create a component that implements `BarzokMapCanvasProps` (see `docs/future-google-maps/` for the previous
implementation), keep the API key in an environment variable restricted by HTTP referrer, and switch to it in
`src/components/BarzokMapCanvas.tsx`.

## Real data, guest walks and audio

- `npm run import:kml -- path/to/map.kml` rebuilds `src/data/seed/{layers,places}.json` and `docs/places-index.csv` from a Google My Maps KML export. Place ids stay stable across re-imports.
- `npm run import:gpx -- path/to/track.gpx --slug=my-route` turns a Wikiloc/GPX track into a walking route; stops are the places within a few metres of the track (review them in /admin).
- **Audio:** put the recordings under `public/audio/` (or any URL, e.g. WordPress media) and list them by place id in `src/data/audio.json`:
  `{ "lodging-003": [{ "url": "audio/lodging-003.mp3", "titleFa": "قصه این مکان" }] }`. Ids are in `docs/places-index.csv`. The walk guide and the place panel show the player automatically.
- Guest walk: choose a route, turn on GPS, and the card shows distance/direction to the next stop, its story and audio. GPS needs HTTPS; in an iframe use `allow="geolocation"` (already in the snippet on the About page).
- Changing the seed (new `meta.json` version) makes browsers drop their old cached copy.
