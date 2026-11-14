#!/usr/bin/env node
/**
 * Import a GPX walking track (e.g. downloaded from Wikiloc) as a guided route.
 *
 *   npm run import:gpx -- path/to/track.gpx --slug=my-route [--max=40] [--keep-stops]
 *
 * - the recorded track becomes the route line on the map (real streets, not straight lines)
 * - stops are picked automatically: every PIN place within --max metres of the track
 *   (default 40), ordered by where you meet it while walking the track
 * - re-running replaces the route with the same --slug; add --keep-stops to keep hand-edited stops
 *
 * Writes/updates: src/data/seed/routes.json and routeStops.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { nearestOnPolyline, polylineLengthMeters } from './lib/geo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED_DIR = path.join(ROOT, 'src/data/seed');

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const keepStops = args.includes('--keep-stops');
const maxMeters = Number(opt('max', 40));

if (!input) {
  console.error('Usage: npm run import:gpx -- path/to/track.gpx --slug=my-route [--max=40] [--keep-stops]');
  process.exit(1);
}

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(SEED_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
};
const writeJson = (file, data) =>
  fs.writeFileSync(path.join(SEED_DIR, file), JSON.stringify(data, null, 2) + '\n');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  isArray: (name) => ['trk', 'trkseg', 'trkpt'].includes(name),
});
const gpx = parser.parse(fs.readFileSync(input, 'utf8')).gpx;
const trk = gpx.trk?.[0];
if (!trk) {
  console.error('No <trk> track found in this GPX file.');
  process.exit(1);
}

const raw = (trk.trkseg || []).flatMap((s) => s.trkpt || []);
const track = [];
for (const p of raw) {
  const pt = [Number(Number(p['@_lat']).toFixed(6)), Number(Number(p['@_lon']).toFixed(6))];
  const last = track[track.length - 1];
  if (!last || last[0] !== pt[0] || last[1] !== pt[1]) track.push(pt);
}
if (track.length < 2) {
  console.error('The track has fewer than 2 points.');
  process.exit(1);
}

// Metadata
const rawTitle = String(gpx.metadata?.name ?? trk.name ?? 'مسیر پیاده‌روی');
const title = rawTitle.replace(/^\s*Wikiloc\s*-\s*/i, '').replace(/\s*-\s*Wikiloc\s*$/i, '').trim();
const lengthKm = polylineLengthMeters(track) / 1000;
const t0 = raw[0]?.time ? Date.parse(raw[0].time) : NaN;
const t1 = raw[raw.length - 1]?.time ? Date.parse(raw[raw.length - 1].time) : NaN;
const minutes = Number.isFinite(t0) && Number.isFinite(t1) ? Math.round((t1 - t0) / 60000) : Math.round(lengthKm * 15);
// Ascent from elevation, ignoring GPS jitter below 3 m.
let ascent = 0;
let ref = Number(raw[0]?.ele);
for (const p of raw) {
  const e = Number(p.ele);
  if (!Number.isFinite(e)) continue;
  if (e - ref > 3) {
    ascent += e - ref;
    ref = e;
  } else if (ref - e > 3) {
    ref = e;
  }
}

const slug = opt('slug', `route-${Date.now().toString(36)}`);
const routeId = `route-${slug}`;

// Pick stops: pin places near the track, ordered along it.
const places = readJson('places.json', []);
const candidates = places
  .filter((p) => !p.geometry)
  .map((p) => ({ place: p, ...nearestOnPolyline([p.latitude, p.longitude], track) }))
  .filter((c) => c.distance <= maxMeters)
  .sort((a, b) => a.along - b.along);

let stops = candidates.map((c, i) => ({
  id: `${routeId}-stop-${i + 1}`,
  routeId,
  placeId: c.place.id,
  stopOrder: i + 1,
  noteFa: null,
  noteEn: null,
  audioUrl: null,
}));
const allStops = readJson('routeStops.json', []);
if (keepStops) {
  const existing = allStops.filter((s) => s.routeId === routeId);
  if (existing.length) stops = existing;
}

const route = {
  id: routeId,
  slug,
  titleFa: title,
  titleEn: null,
  descriptionFa: `ردّ واقعی پیاده‌روی، ثبت‌شده با GPS (منبع: Wikiloc). ایستگاه‌ها به‌صورت خودکار از مکان‌های نزدیک مسیر انتخاب شده‌اند.`,
  descriptionEn: null,
  durationMinutes: Math.max(1, minutes),
  distanceKm: Number(lengthKm.toFixed(2)),
  difficulty: ascent < 60 ? 'easy' : ascent < 200 ? 'moderate' : 'hard',
  color: '#D6A83F',
  publicationStatus: 'published',
  verificationStatus: 'community',
  isDemo: false,
  createdAt: new Date().toISOString(),
  track,
};

const routes = readJson('routes.json', []).filter((r) => r.id !== routeId);
routes.push(route);
writeJson('routes.json', routes);
writeJson('routeStops.json', [...allStops.filter((s) => s.routeId !== routeId), ...stops]);

console.log(`route: ${title}`);
console.log(`track points: ${track.length}, length: ${lengthKm.toFixed(2)} km, ~${minutes} min, ascent ≈ ${Math.round(ascent)} m (${route.difficulty})`);
console.log(`stops within ${maxMeters} m of the track: ${stops.length}`);
for (const c of candidates) {
  console.log(
    `  ${String(Math.round(c.along)).padStart(5)} m  (${String(Math.round(c.distance)).padStart(2)} m off)  ${c.place.id}  ${c.place.nameFa}${c.place.shortIntroFa ? '' : '  [no story text]'}`
  );
}
