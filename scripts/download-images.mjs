// Downloads the place photos that are still hotlinked from Google My Maps and stores them in
// public/images/barzok/, then rewrites places.json to use the local copies.
// Run it on YOUR computer (it needs normal internet access):  npm run import:images
// Safe to re-run: photos already downloaded are skipped, failed ones stay as links.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const placesFile = path.join(root, 'src/data/seed/places.json');
const outDir = path.join(root, 'public/images/barzok');
fs.mkdirSync(outDir, { recursive: true });

const places = JSON.parse(fs.readFileSync(placesFile, 'utf8'));
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

const jobs = [];
for (const place of places) {
  let photos = [];
  try { photos = JSON.parse(place.recentPhotos || '[]'); } catch { /* ignore */ }
  photos.forEach((ph, i) => {
    if (/^https?:\/\//.test(ph.url)) jobs.push({ place, photos, ph, i });
  });
}
console.log(`${jobs.length} photos to download`);

let ok = 0, failed = 0, next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    const base = `${job.place.id}-${job.i + 1}`;
    try {
      const res = await fetch(job.ph.url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = (res.headers.get('content-type') || '').split(';')[0];
      const ext = EXT[type] || 'jpg';
      fs.writeFileSync(path.join(outDir, `${base}.${ext}`), Buffer.from(await res.arrayBuffer()));
      job.ph.url = `images/barzok/${base}.${ext}`;
      ok++;
    } catch (err) {
      failed++;
      console.warn(`  failed ${base}: ${err.message}`);
    }
    if ((ok + failed) % 20 === 0) console.log(`  ${ok + failed}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

for (const place of places) {
  try {
    const photos = JSON.parse(place.recentPhotos || '[]');
    place.recentPhotos = JSON.stringify(photos);
  } catch { /* leave as is */ }
}
// jobs hold references to the parsed arrays, so write them back
const byPlace = new Map();
for (const j of jobs) byPlace.set(j.place.id, j.photos);
for (const place of places) if (byPlace.has(place.id)) place.recentPhotos = JSON.stringify(byPlace.get(place.id));
fs.writeFileSync(placesFile, JSON.stringify(places, null, 2) + '\n');

// new seed version so browsers pick up the change
const metaFile = path.join(root, 'src/data/seed/meta.json');
const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
meta.version = new Date().toISOString();
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');

console.log(`done: ${ok} downloaded, ${failed} failed`);
if (failed) console.log('Run the command again to retry the failed ones.');
