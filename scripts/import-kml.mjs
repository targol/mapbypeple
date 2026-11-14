#!/usr/bin/env node
/**
 * Import a Google My Maps KML export into the app's JSON seed.
 *
 *   npm run import:kml -- path/to/map.kml
 *
 * - every KML <Folder> becomes a layer (icon/colour presets below, unknown folders get defaults)
 * - Point        -> a place shown as a pin
 * - LineString   -> a place drawn as a line (water channels, streets…)
 * - Polygon      -> a place drawn as an area (gardens, neighbourhoods, hills…)
 * - description  -> text of the story/description; its photo(s) -> place photos
 * - place ids are stable: re-importing an edited map keeps the id of every place whose layer and
 *   name are unchanged, so audio files attached by id keep working.
 *
 * Writes: src/data/seed/layers.json, places.json, meta.json and docs/places-index.csv
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { centroid } from './lib/geo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED_DIR = path.join(ROOT, 'src/data/seed');
const SOURCE = 'نقشه مردم‌نگار برزک (Google My Maps)';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run import:kml -- path/to/map.kml');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Layer presets (matched by folder name). Colours are chosen to stay readable
// with a white icon on top; icons must exist in src/components/LayerIcon.tsx.
// ---------------------------------------------------------------------------
const PRESETS = [
  { test: (n) => n.includes('اقامتگاه'), slug: 'lodging', icon: 'home', color: '#6A1B9A', nameEn: 'Eco-lodges' },
  { test: (n) => n.startsWith('آب'), slug: 'water', icon: 'droplets', color: '#0288D1', nameEn: 'Water, Qanats & Mills' },
  { test: (n) => n.includes('باغ'), slug: 'gardens', icon: 'trees', color: '#097138', nameEn: 'Gardens & Green Spaces' },
  { test: (n) => n.includes('محلات'), slug: 'neighbourhoods', icon: 'users', color: '#A67C00', nameEn: 'Neighbourhoods' },
  { test: (n) => n.includes('عمومی'), slug: 'public-places', icon: 'landmark', color: '#F57C00', nameEn: 'Public Places' },
  { test: (n) => n.includes('مذهبی'), slug: 'religious', icon: 'moon', color: '#00796B', nameEn: 'Religious Places' },
  { test: (n) => n.includes('نانوایی'), slug: 'bakeries', icon: 'wheat', color: '#E65100', nameEn: 'Bakeries' },
  { test: (n) => n.includes('معابر'), slug: 'streets', icon: 'route', color: '#880E4F', nameEn: 'Streets & Alleys' },
  { test: (n) => n.includes('کوه'), slug: 'mountains', icon: 'mountain', color: '#795548', nameEn: 'Mountains & Hills' },
];

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------
const BIDI = /[‎‏‪-‮⁦-⁩﻿]/g; // direction marks My Maps sprinkles in; ZWNJ (U+200C) is kept on purpose

const clean = (s) => String(s ?? '').replace(BIDI, '').replace(/[ \t]+/g, ' ').trim();

const textOf = (node) => {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'object') return node.__cdata ?? node['#text'] ?? '';
  return String(node);
};

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

function parseDescription(html) {
  const raw = textOf(html);
  const images = [...raw.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => decodeEntities(m[1]));
  const text = decodeEntities(
    raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(BIDI, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text, images };
}

// "lon,lat,alt lon,lat,alt …"  ->  [[lat, lng], …]
const parseCoords = (node) =>
  textOf(node)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const [lng, lat] = t.split(',').map(Number);
      return [Number(lat.toFixed(7)), Number(lng.toFixed(7))];
    })
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

// My Maps style ids carry the colour: #line-0288D1-1200, #poly-097138-1200-77
function shapeStyle(styleUrl) {
  const m = /^#(line|poly)-([0-9a-fA-F]{6})-\d+(?:-([0-9a-fA-F]{2}))?/.exec(styleUrl || '');
  if (!m) return {};
  const color = `#${m[2].toUpperCase()}`;
  const alpha = m[3] ? parseInt(m[3], 16) / 255 : undefined;
  return { color: color === '#000000' ? undefined : color, fillOpacity: alpha };
}

// Short bold lead + remaining text, so the detail panel never shows the same text twice.
function splitStory(text) {
  if (!text) return ['', ''];
  if (text.length <= 160) return [text, ''];
  const m = /^[\s\S]{40,220}?[.!؟?](?=\s)/.exec(text);
  if (!m) return [text, ''];
  const lead = m[0].trim();
  const rest = text.slice(m[0].length).trim();
  return [lead, rest];
}

// ---------------------------------------------------------------------------
// Read + convert
// ---------------------------------------------------------------------------
const xml = fs.readFileSync(input, 'utf8');
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
  cdataPropName: '__cdata',
  isArray: (name) => ['Folder', 'Placemark', 'Data'].includes(name),
});
const kml = parser.parse(xml).kml;
const doc = kml.Document;
const folders = doc.Folder || [];
if (folders.length === 0) {
  console.error('No <Folder> found in this KML. Export the whole map ("Export entire map to a KML file").');
  process.exit(1);
}

// Reuse ids of a previous import (same layer + same name, in order).
const previous = new Map();
try {
  const old = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'places.json'), 'utf8'));
  for (const p of old) {
    if (p.sourceReference !== SOURCE) continue;
    const key = `${p.layerId}|${p.nameFa}`;
    if (!previous.has(key)) previous.set(key, []);
    previous.get(key).push(p.id);
  }
} catch {
  /* first import */
}
const usedIds = new Set();

const now = new Date().toISOString();
const layers = [];
const places = [];
const warnings = [];

folders.forEach((folder, folderIndex) => {
  const folderName = clean(textOf(folder.name));
  const preset = PRESETS.find((p) => p.test(folderName));
  const slug = preset?.slug ?? `layer-${folderIndex + 1}`;
  const layerId = `layer-${slug}`;
  layers.push({
    id: layerId,
    slug,
    nameFa: folderName,
    nameEn: preset?.nameEn ?? null,
    descriptionFa: null,
    descriptionEn: null,
    icon: preset?.icon ?? 'map-pin',
    color: preset?.color ?? '#254B36',
    isVisible: true,
    isActive: true,
    displayOrder: folderIndex + 1,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  });

  let counter = 0;
  const nextId = () => {
    let id;
    do {
      counter += 1;
      id = `${slug}-${String(counter).padStart(3, '0')}`;
    } while (usedIds.has(id));
    return id;
  };

  for (const pm of folder.Placemark || []) {
    const name = clean(textOf(pm.name)) || '(بدون نام)';
    const { text, images } = parseDescription(pm.description);

    const media = (pm.ExtendedData?.Data || [])
      .filter((d) => d['@_name'] === 'gx_media_links')
      .flatMap((d) => textOf(d.value).trim().split(/\s+/))
      .filter(Boolean);
    const photos = [...new Set([...images, ...media])];

    let geometry;
    let lat;
    let lng;
    if (pm.Point) {
      [[lat, lng]] = parseCoords(pm.Point.coordinates);
    } else if (pm.LineString) {
      const coordinates = parseCoords(pm.LineString.coordinates);
      [lat, lng] = coordinates[Math.floor(coordinates.length / 2)];
      geometry = { type: 'LineString', coordinates, ...shapeStyle(textOf(pm.styleUrl)) };
    } else if (pm.Polygon) {
      const coordinates = parseCoords(pm.Polygon.outerBoundaryIs.LinearRing.coordinates);
      [lat, lng] = centroid(coordinates).map((n) => Number(n.toFixed(7)));
      geometry = { type: 'Polygon', coordinates, ...shapeStyle(textOf(pm.styleUrl)) };
    } else {
      warnings.push(`skipped "${name}" in ${folderName}: unsupported geometry`);
      continue;
    }
    if (geometry) {
      if (geometry.color === undefined) delete geometry.color;
      if (geometry.fillOpacity === undefined) delete geometry.fillOpacity;
    }

    const reuse = previous.get(`${layerId}|${name}`)?.shift();
    const id = reuse && !usedIds.has(reuse) ? reuse : nextId();
    usedIds.add(id);

    const [lead, rest] = splitStory(text);
    const place = {
      id,
      slug: id,
      layerId,
      additionalLayerIds: '[]',
      nameFa: name,
      nameEn: null,
      category: folderName,
      shortIntroFa: lead,
      shortIntroEn: null,
      fullDescriptionFa: rest,
      fullDescriptionEn: null,
      latitude: lat,
      longitude: lng,
      historicalInfoFa: null,
      historicalInfoEn: null,
      currentStatusFa: null,
      currentStatusEn: null,
      historicalPhotos: '[]',
      recentPhotos: JSON.stringify(photos.map((url) => ({ url, captionFa: name }))),
      audioRecordings: '[]',
      videoLinks: '[]',
      sourceReference: SOURCE,
      documentationDate: null,
      contributorName: 'خانه برزک',
      contributorApproved: true,
      publicationStatus: 'published',
      verificationStatus: 'community',
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };
    if (geometry) place.geometry = geometry;
    places.push(place);
  }
});

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------
fs.mkdirSync(SEED_DIR, { recursive: true });
const write = (file, data) =>
  fs.writeFileSync(path.join(SEED_DIR, file), JSON.stringify(data, null, 2) + '\n');
write('layers.json', layers);
write('places.json', places);
write('meta.json', { version: now, source: path.basename(input) });

// Index for people who record audio: which id belongs to which place.
let audioManifest = {};
try {
  audioManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/audio.json'), 'utf8'));
} catch {
  /* no manifest yet */
}
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const rows = [['id', 'layer', 'type', 'name', 'has_story_text', 'has_photo', 'audio_attached'].join(',')];
for (const p of places) {
  const layer = layers.find((l) => l.id === p.layerId);
  rows.push(
    [
      p.id,
      layer.nameFa,
      p.geometry?.type ?? 'Point',
      p.nameFa,
      p.shortIntroFa ? 'yes' : 'no',
      JSON.parse(p.recentPhotos).length ? 'yes' : 'no',
      audioManifest[p.id] ? 'yes' : 'no',
    ]
      .map(csvCell)
      .join(',')
  );
}
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/places-index.csv'), '﻿' + rows.join('\n') + '\n');

const by = (fn) => places.reduce((m, p) => ((m[fn(p)] = (m[fn(p)] || 0) + 1), m), {});
console.log(`layers: ${layers.length}`);
console.log(`places: ${places.length}`, by((p) => p.geometry?.type ?? 'Point'));
console.log(`with story text: ${places.filter((p) => p.shortIntroFa).length}`);
console.log(`with photo: ${places.filter((p) => JSON.parse(p.recentPhotos).length).length}`);
const orphanAudio = Object.keys(audioManifest).filter((id) => !places.some((p) => p.id === id));
if (orphanAudio.length) warnings.push(`audio.json has ids that no longer exist: ${orphanAudio.join(', ')}`);
warnings.forEach((w) => console.warn('WARNING:', w));
