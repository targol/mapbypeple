// Browser-only replacement for the Express + PostgreSQL backend.
//
// It answers the same "routes" the old server.ts exposed (e.g. GET /api/public/map-bundle,
// PUT /api/admin/places/:id) from a JSON seed + localStorage, so the UI code does not need
// to know whether data comes from the browser, a Supabase adapter, or a real server.
// See ./api.ts for the switch between this local backend and a remote one.
//
// Limits (by design, for a prototype): data lives only in the visitor's own browser,
// there is no real authentication, and nothing is shared between visitors.
import type {
  AdminBundle,
  ContributionRecord,
  EventRecord,
  LayerRecord,
  MediaRecord,
  PersonRecord,
  PlacePersonLink,
  PlaceRecord,
  PlaceStoryLink,
  PublicMapBundle,
  RouteRecord,
  RouteStopRecord,
  StoryRecord,
} from '../types';
import { BARZOK_CENTER } from '../types';
import { AUDIO_MANIFEST, SEED, SEED_VERSION } from './seed';

export const STORAGE_KEY = 'barzok-people-map:v1';

type RouteRow = Omit<RouteRecord, 'stops'>;

interface LocalDb {
  layers: LayerRecord[];
  places: PlaceRecord[];
  people: PersonRecord[];
  stories: StoryRecord[];
  events: EventRecord[];
  routes: RouteRow[];
  routeStops: RouteStopRecord[];
  media: MediaRecord[];
  contributions: ContributionRecord[];
  placePeople: PlacePersonLink[];
  placeStories: PlaceStoryLink[];
  seedVersion?: string;
}

const COLLECTIONS: (keyof LocalDb)[] = [
  'layers',
  'places',
  'people',
  'stories',
  'events',
  'routes',
  'routeStops',
  'media',
  'contributions',
  'placePeople',
  'placeStories',
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();

function newId(prefix: string): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch {
    // fall through
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

let cache: LocalDb | null = null;

function seedDb(): LocalDb {
  return clone({ ...SEED, media: [] as MediaRecord[], seedVersion: SEED_VERSION }) as LocalDb;
}

function readStorage(): LocalDb | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.layers) &&
      Array.isArray(parsed.places) &&
      parsed.seedVersion === SEED_VERSION // older cached data (e.g. the demo seed) is discarded
    ) {
      return parsed as LocalDb;
    }
  } catch {
    // corrupted JSON or storage blocked → fall back to the seed
  }
  return null;
}

function writeStorage(db: LocalDb) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage can be blocked (private mode, sandboxed iframe, quota).
    // The in-memory copy keeps the session working.
  }
}

// --- Data published on the host (data.json next to index.html) --------------------------------
// Visitors always see data.json when it exists. An admin's own unsaved edits live in
// localStorage and are flagged "dirty" until they are published with the "publish" button.
const DIRTY_KEY = `${STORAGE_KEY}:dirty`;
let hosted: LocalDb | null = null;
let hostedLoad: Promise<void> | null = null;

function loadHosted(): Promise<void> {
  if (!hostedLoad) {
    hostedLoad = (async () => {
      try {
        const res = await fetch(`data.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (json && Array.isArray(json.layers) && Array.isArray(json.places)) hosted = json as LocalDb;
      } catch {
        // no data.json on this host (or opened from a dev server): the built-in seed is used
      }
    })();
  }
  return hostedLoad;
}

export function isDirty(): boolean {
  try {
    return window.localStorage.getItem(DIRTY_KEY) === '1';
  } catch {
    return false;
  }
}

function setDirty(value: boolean) {
  try {
    if (value) window.localStorage.setItem(DIRTY_KEY, '1');
    else window.localStorage.removeItem(DIRTY_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('barzok-dirty-changed'));
}

/** Everything that may be published. Visitors' private submissions (contributions) never leave the browser. */
export function getPublishSnapshot() {
  const db = getDb();
  const { contributions: _c, media: _m, ...rest } = db;
  return clone(rest);
}

export function markPublished() {
  setDirty(false);
}

/** Drop unsaved local edits and show the host's version again. */
export function discardLocalEdits() {
  cache = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  setDirty(false);
}

function getDb(): LocalDb {
  if (!cache) {
    const local = readStorage();
    if (local && isDirty()) cache = local;
    else if (hosted) {
      cache = clone(hosted);
      (cache as LocalDb).contributions = local?.contributions ?? [];
      (cache as LocalDb).media = local?.media ?? [];
    } else cache = local ?? seedDb();
    for (const key of COLLECTIONS) {
      if (!Array.isArray(cache[key])) (cache as any)[key] = [];
    }
  }
  return cache;
}

function commit() {
  writeStorage(getDb());
  setDirty(true);
}

/** Throw away local edits and go back to the JSON seed. */
export function resetLocalData() {
  cache = hosted ? null : seedDb();
  if (cache) writeStorage(cache);
  else discardLocalEdits();
  setDirty(false);
}

// Seed image paths are relative ("images/barzok/x.jpg"); make them absolute against BASE_URL.
function withAssetBase<T>(value: T): T {
  const base = (import.meta.env.BASE_URL as string) || '/';
  const json = JSON.stringify(value).replace(
    /(?<![\w/.-])images\/barzok\//g,
    `${base.endsWith('/') ? base : `${base}/`}images/barzok/`
  );
  return JSON.parse(json);
}

// ---------------------------------------------------------------------------
// Helpers ported from server.ts / repository.ts
// ---------------------------------------------------------------------------

function normalizeCoord(val: unknown, fallback: number): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const normalized = val
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[/،,]/g, '.')
      .trim();
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

const asJsonString = (value: unknown, fallback: unknown) =>
  typeof value === 'string' ? value : JSON.stringify(value || fallback);

const byCreatedDesc = (a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
const byCreatedAsc = (a: any, b: any) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''));

function uniqueSlug(list: { slug: string; id: string }[], slug: string, selfId?: string) {
  const taken = list.some((item) => item.slug === slug && item.id !== selfId);
  return taken ? `${slug}-${Date.now().toString(36)}` : slug;
}

const defaultSlug = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

function setPlacePeople(placeId: string, personIds: string[]) {
  const db = getDb();
  const valid = new Set(db.people.map((p) => p.id));
  db.placePeople = db.placePeople.filter((l) => l.placeId !== placeId);
  for (const personId of personIds) {
    if (valid.has(personId)) {
      db.placePeople.push({ id: newId('pp'), placeId, personId });
    }
  }
}

function setPlaceEvents(placeId: string, eventIds: string[]) {
  const db = getDb();
  for (const ev of db.events) {
    if (eventIds.includes(ev.id)) ev.placeId = placeId;
    else if (ev.placeId === placeId) ev.placeId = null;
  }
}

function setPlaceStories(placeId: string, storyIds: string[]) {
  const db = getDb();
  const valid = new Set(db.stories.map((s) => s.id));
  db.placeStories = db.placeStories.filter((l) => l.placeId !== placeId);
  for (const storyId of storyIds) {
    if (valid.has(storyId)) {
      db.placeStories.push({ id: newId('ps'), placeId, storyId });
    }
  }
}

function setStoryPlaces(storyId: string, placeIds: string[]) {
  const db = getDb();
  const valid = new Set(db.places.map((p) => p.id));
  db.placeStories = db.placeStories.filter((l) => l.storyId !== storyId);
  for (const placeId of placeIds) {
    if (valid.has(placeId)) {
      db.placeStories.push({ id: newId('ps'), placeId, storyId });
    }
  }
}

function setRouteStops(
  routeId: string,
  stops: { placeId: string; stopOrder?: number; noteFa?: string; noteEn?: string }[]
) {
  const db = getDb();
  const valid = new Set(db.places.map((p) => p.id));
  db.routeStops = db.routeStops.filter((s) => s.routeId !== routeId);
  stops
    .filter((s) => valid.has(s.placeId))
    .forEach((s, idx) => {
      db.routeStops.push({
        id: newId('stop'),
        routeId,
        placeId: s.placeId,
        stopOrder: s.stopOrder || idx + 1,
        noteFa: s.noteFa || null,
        noteEn: s.noteEn || null,
      });
    });
}

function validLayerId(layerId: unknown): string | null {
  const db = getDb();
  const sorted = [...db.layers].sort((a, b) => a.displayOrder - b.displayOrder);
  if (typeof layerId === 'string' && db.layers.some((l) => l.id === layerId)) return layerId;
  return sorted[0]?.id ?? null;
}

// Approved community contributions become public places (and stories for personal memories);
// anything un-approved is hidden again. Ported from syncApprovedContributionsToPlaces().
function syncApprovedContributionsToPlaces() {
  const db = getDb();
  if (db.contributions.length === 0) return;

  const sortedLayers = [...db.layers].sort((a, b) => a.displayOrder - b.displayOrder);
  const layerBySlug: Record<string, string> = {};
  for (const l of sortedLayers) layerBySlug[l.slug] = l.id;
  const defaultLayerId = sortedLayers[0]?.id ?? null;

  for (const c of db.contributions) {
    const placeSlug = `contrib-place-${c.id}`;
    const existingPlace = db.places.find((p) => p.slug === placeSlug);

    if (c.moderationStatus === 'approved') {
      let targetLayerId = defaultLayerId;
      let targetCategory = 'میراث و معماری';

      switch (c.submissionType) {
        case 'historical_location':
          targetLayerId = layerBySlug['heritage-architecture'] || defaultLayerId;
          targetCategory = 'میراث و معماری';
          break;
        case 'old_photograph':
        case 'personal_memory':
          targetLayerId = layerBySlug['memories-documents'] || defaultLayerId;
          targetCategory = 'خاطرات و اسناد';
          break;
        case 'local_person':
          targetLayerId = layerBySlug['people-occupations'] || defaultLayerId;
          targetCategory = 'مردم و مشاغل';
          break;
        case 'traditional_custom':
          targetLayerId = layerBySlug['culture-rituals'] || defaultLayerId;
          targetCategory = 'فرهنگ و آیین‌ها';
          break;
        case 'environmental_cultural':
          targetLayerId = layerBySlug['nature-environment'] || defaultLayerId;
          targetCategory = 'طبیعت و محیط‌زیست';
          break;
      }

      let ensuredPlaceId = existingPlace?.id;
      if (!existingPlace) {
        const ts = nowIso();
        const place: PlaceRecord = {
          id: newId('place'),
          slug: placeSlug,
          layerId: targetLayerId,
          additionalLayerIds: JSON.stringify([]),
          nameFa: c.title,
          nameEn: null,
          category: targetCategory,
          shortIntroFa: c.description,
          shortIntroEn: null,
          fullDescriptionFa: c.description,
          fullDescriptionEn: null,
          latitude: c.latitude ?? BARZOK_CENTER.lat,
          longitude: c.longitude ?? BARZOK_CENTER.lng,
          historicalInfoFa: null,
          historicalInfoEn: null,
          currentStatusFa: 'ثبت‌شده از طریق مشارکت مردمی',
          currentStatusEn: 'Community Contributed Record',
          historicalPhotos: JSON.stringify([]),
          recentPhotos: c.mediaUrl
            ? JSON.stringify([{ url: c.mediaUrl, captionFa: c.title, year: 'مشارکت مردمی' }])
            : JSON.stringify([]),
          audioRecordings: JSON.stringify([]),
          videoLinks: JSON.stringify([]),
          sourceReference: `مشارکت مردمی (${c.contributorName})`,
          documentationDate: '۱۴۰۵',
          contributorName: c.contributorName,
          contributorApproved: true,
          publicationStatus: 'published',
          verificationStatus: 'community',
          isDemo: false,
          createdAt: ts,
          updatedAt: ts,
        };
        db.places.push(place);
        ensuredPlaceId = place.id;
      } else if (existingPlace.publicationStatus !== 'published') {
        existingPlace.publicationStatus = 'published';
        existingPlace.updatedAt = nowIso();
      }

      if (c.submissionType === 'personal_memory' && ensuredPlaceId) {
        const storySlug = `contrib-story-${c.id}`;
        if (!db.stories.some((s) => s.slug === storySlug)) {
          const ts = nowIso();
          const story: StoryRecord = {
            id: newId('story'),
            slug: storySlug,
            titleFa: c.title,
            titleEn: null,
            summaryFa: c.description.slice(0, 180),
            summaryEn: null,
            contentFa: c.description,
            contentEn: null,
            narratorName: c.contributorName,
            audioUrl: null,
            imageUrl: c.mediaUrl || null,
            recordedDate: null,
            sourceReference: `مشارکت مردمی (${c.contributorName})`,
            contributorName: c.contributorName,
            publicationStatus: 'published',
            verificationStatus: 'community',
            isDemo: false,
            createdAt: ts,
          };
          db.stories.push(story);
          db.placeStories.push({ id: newId('ps'), placeId: ensuredPlaceId, storyId: story.id });
        }
      }
    } else if (existingPlace && existingPlace.publicationStatus === 'published') {
      existingPlace.publicationStatus = 'draft';
      existingPlace.updatedAt = nowIso();
    }
  }
}

// ---------------------------------------------------------------------------
// Bundles
// ---------------------------------------------------------------------------

// Audio files listed in src/data/audio.json are attached to places by id at read time,
// so the large places.json never has to be edited by hand.
function withAudio(place: PlaceRecord): PlaceRecord {
  const extra = AUDIO_MANIFEST[place.id];
  if (!extra || extra.length === 0) return place;
  let current: unknown[] = [];
  try {
    current = JSON.parse(place.audioRecordings || '[]');
  } catch {
    current = [];
  }
  return { ...place, audioRecordings: JSON.stringify([...current, ...extra]) };
}

function routesWithStops(rows: RouteRow[]): RouteRecord[] {
  const db = getDb();
  return rows.map((r) => ({
    ...r,
    stops: db.routeStops
      .filter((s) => s.routeId === r.id)
      .sort((a, b) => a.stopOrder - b.stopOrder),
  }));
}

export function getPublicMapBundle(): PublicMapBundle {
  syncApprovedContributionsToPlaces();
  commit();
  const db = getDb();
  const published = <T extends { publicationStatus: string }>(rows: T[]) =>
    rows.filter((r) => r.publicationStatus === 'published');

  return withAssetBase({
    layers: db.layers.filter((l) => l.isActive).sort((a, b) => a.displayOrder - b.displayOrder),
    places: published(db.places).sort(byCreatedDesc).map(withAudio),
    people: published(db.people).sort(byCreatedDesc),
    stories: published(db.stories).sort(byCreatedDesc),
    events: published(db.events).sort(byCreatedDesc),
    routes: routesWithStops(published(db.routes).sort(byCreatedAsc)),
    placePeople: db.placePeople,
    placeStories: db.placeStories,
  });
}

export function getAdminBundle() {
  syncApprovedContributionsToPlaces();
  commit();
  const db = getDb();
  return withAssetBase({
    layers: [...db.layers].sort((a, b) => a.displayOrder - b.displayOrder),
    places: [...db.places].sort(byCreatedDesc),
    people: [...db.people].sort(byCreatedDesc),
    stories: [...db.stories].sort(byCreatedDesc),
    media: [...db.media].sort(byCreatedDesc),
    events: [...db.events].sort(byCreatedDesc),
    activities: [],
    routes: routesWithStops([...db.routes].sort(byCreatedDesc)),
    contributions: [...db.contributions].sort(byCreatedDesc),
    placePeople: db.placePeople,
    placeStories: db.placeStories,
    currentUser: {
      uid: 'barzok-demo-admin',
      email: 'demo-admin@local',
      displayName: 'Demo Admin (local mode)',
      role: 'admin',
    },
  }) as AdminBundle & { activities: unknown[]; currentUser: unknown };
}

// ---------------------------------------------------------------------------
// Mutations (one function per resource; each mirrors a route in server.ts)
// ---------------------------------------------------------------------------

type Body = Record<string, any>;

function stripImmutable(body: Body) {
  const { id: _id, createdAt: _createdAt, ...rest } = body || {};
  return rest;
}

function createContribution(b: Body) {
  if (!b.submissionType || !b.title || !b.description || !b.contributorName || !b.contactInfo) {
    throw new Error('لطفاً تمام فیلدهای الزامی را تکمیل نمایید.');
  }
  if (!b.consentToPublish) {
    throw new Error('تایید رضایت‌نامه انتشار برای ارسال مشارکت الزامی است.');
  }
  const db = getDb();
  const ts = nowIso();
  const record: ContributionRecord = {
    id: newId('contrib'),
    submissionType: b.submissionType,
    title: b.title,
    description: b.description,
    latitude: b.latitude !== undefined && b.latitude !== '' && b.latitude !== null ? Number(b.latitude) : null,
    longitude: b.longitude !== undefined && b.longitude !== '' && b.longitude !== null ? Number(b.longitude) : null,
    mediaUrl: b.mediaUrl || null,
    contributorName: b.contributorName,
    contactInfo: b.contactInfo,
    consentToPublish: Boolean(b.consentToPublish),
    moderationStatus: 'pending_review',
    adminNotes: null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.contributions.push(record);
  commit();
  return {
    id: record.id,
    submissionType: record.submissionType,
    title: record.title,
    moderationStatus: record.moderationStatus,
    createdAt: record.createdAt,
  };
}

function createLayer(b: Body) {
  if (!b.nameFa) throw new Error('نام فارسی لایه الزامی است.');
  const db = getDb();
  const ts = nowIso();
  const layer: LayerRecord = {
    id: newId('layer'),
    slug: uniqueSlug(db.layers, b.slug || defaultSlug('layer'), undefined),
    nameFa: b.nameFa,
    nameEn: b.nameEn || null,
    descriptionFa: b.descriptionFa || null,
    descriptionEn: b.descriptionEn || null,
    icon: b.icon || 'landmark',
    color: b.color || '#254B36',
    isVisible: b.isVisible !== undefined ? Boolean(b.isVisible) : true,
    isActive: b.isActive !== undefined ? Boolean(b.isActive) : true,
    displayOrder: Number(b.displayOrder) || 0,
    isDemo: Boolean(b.isDemo),
    createdAt: ts,
    updatedAt: ts,
  };
  db.layers.push(layer);
  commit();
  return layer;
}

function createPlace(b: Body) {
  if (!b.nameFa || !String(b.nameFa).trim()) {
    throw new Error('وارد کردن «نام فارسی مکان» الزامی است.');
  }
  const db = getDb();
  const ts = nowIso();
  const nameFa = String(b.nameFa).trim();
  const shortIntroFa = (b.shortIntroFa && String(b.shortIntroFa).trim()) || nameFa;
  const place: PlaceRecord = {
    id: newId('place'),
    slug: uniqueSlug(db.places, (b.slug && String(b.slug).trim()) || defaultSlug('place')),
    layerId: validLayerId(b.layerId),
    additionalLayerIds: asJsonString(b.additionalLayerIds, []),
    nameFa,
    nameEn: b.nameEn ? String(b.nameEn).trim() : null,
    category: b.category || 'میراث و معماری',
    shortIntroFa,
    shortIntroEn: b.shortIntroEn || null,
    fullDescriptionFa: (b.fullDescriptionFa && String(b.fullDescriptionFa).trim()) || shortIntroFa,
    fullDescriptionEn: b.fullDescriptionEn || null,
    ...(b.geometry ? { geometry: b.geometry } : {}),
    neighbourhoodId: b.neighbourhoodId || null,
    latitude: normalizeCoord(b.latitude, BARZOK_CENTER.lat),
    longitude: normalizeCoord(b.longitude, BARZOK_CENTER.lng),
    historicalInfoFa: b.historicalInfoFa || null,
    historicalInfoEn: b.historicalInfoEn || null,
    currentStatusFa: b.currentStatusFa || null,
    currentStatusEn: b.currentStatusEn || null,
    historicalPhotos: asJsonString(b.historicalPhotos, []),
    recentPhotos: asJsonString(b.recentPhotos, []),
    audioRecordings: asJsonString(b.audioRecordings, []),
    videoLinks: asJsonString(b.videoLinks, []),
    sourceReference: b.sourceReference || null,
    documentationDate: b.documentationDate || null,
    contributorName: b.contributorName || null,
    contributorApproved: Boolean(b.contributorApproved),
    publicationStatus: b.publicationStatus || 'published',
    verificationStatus: b.verificationStatus || 'verified',
    isDemo: Boolean(b.isDemo),
    createdAt: ts,
    updatedAt: ts,
  };
  db.places.push(place);
  setPlacePeople(place.id, Array.isArray(b.personIds) ? b.personIds : []);
  if (Array.isArray(b.eventIds)) setPlaceEvents(place.id, b.eventIds);
  setPlaceStories(place.id, Array.isArray(b.storyIds) ? b.storyIds : []);
  commit();
  return place;
}

function updatePlace(id: string, b: Body) {
  const db = getDb();
  const place = db.places.find((p) => p.id === id);
  if (!place) throw new Error('مکان موردنظر یافت نشد.');
  const { personIds, storyIds, eventIds, ...fields } = stripImmutable(b);
  const payload: Body = { ...fields };

  if (payload.latitude !== undefined) payload.latitude = normalizeCoord(payload.latitude, BARZOK_CENTER.lat);
  if (payload.longitude !== undefined) payload.longitude = normalizeCoord(payload.longitude, BARZOK_CENTER.lng);
  for (const key of ['additionalLayerIds', 'historicalPhotos', 'recentPhotos', 'audioRecordings', 'videoLinks']) {
    if (payload[key] && typeof payload[key] !== 'string') payload[key] = JSON.stringify(payload[key]);
  }
  if (payload.layerId !== undefined) payload.layerId = validLayerId(payload.layerId);

  Object.assign(place, payload, { updatedAt: nowIso() });
  if (Array.isArray(personIds)) setPlacePeople(id, personIds);
  if (Array.isArray(eventIds)) setPlaceEvents(id, eventIds);
  if (Array.isArray(storyIds)) setPlaceStories(id, storyIds);
  commit();
  return place;
}

function createPerson(b: Body) {
  if (!b.nameFa || !b.occupationFa || !b.bioFa) {
    throw new Error('نام، پیشه و زندگی‌نامه فارسی الزامی است.');
  }
  const db = getDb();
  const ts = nowIso();
  const person: PersonRecord = {
    id: newId('person'),
    nameFa: b.nameFa,
    nameEn: b.nameEn || null,
    occupationFa: b.occupationFa,
    occupationEn: b.occupationEn || null,
    bioFa: b.bioFa,
    bioEn: b.bioEn || null,
    era: b.era || null,
    avatarUrl: b.avatarUrl || null,
    sourceReference: b.sourceReference || null,
    contributorName: b.contributorName || null,
    publicationStatus: b.publicationStatus || 'published',
    verificationStatus: b.verificationStatus || 'verified',
    isDemo: Boolean(b.isDemo),
    createdAt: ts,
  };
  db.people.push(person);
  commit();
  return person;
}

function createStory(b: Body) {
  if (!b.titleFa || !b.contentFa) throw new Error('عنوان و متن داستان الزامی است.');
  const db = getDb();
  const ts = nowIso();
  const story: StoryRecord = {
    id: newId('story'),
    slug: uniqueSlug(db.stories, b.slug || defaultSlug('story')),
    titleFa: b.titleFa,
    titleEn: b.titleEn || null,
    summaryFa: b.summaryFa || b.titleFa,
    summaryEn: b.summaryEn || null,
    contentFa: b.contentFa,
    contentEn: b.contentEn || null,
    narratorName: b.narratorName || null,
    audioUrl: b.audioUrl || null,
    imageUrl: b.imageUrl || null,
    recordedDate: b.recordedDate || null,
    sourceReference: b.sourceReference || null,
    contributorName: b.contributorName || null,
    publicationStatus: b.publicationStatus || 'published',
    verificationStatus: b.verificationStatus || 'verified',
    isDemo: Boolean(b.isDemo),
    createdAt: ts,
  };
  db.stories.push(story);
  setStoryPlaces(story.id, Array.isArray(b.placeIds) ? b.placeIds : []);
  commit();
  return story;
}

function createEvent(b: Body) {
  if (!b.titleFa || !b.descriptionFa || !b.seasonOrDateFa) {
    throw new Error('عنوان، زمان برگزاری و توضیحات رویداد الزامی است.');
  }
  const db = getDb();
  const event = {
    id: newId('event'),
    placeId: b.placeId || null,
    titleFa: b.titleFa,
    titleEn: b.titleEn || null,
    descriptionFa: b.descriptionFa,
    descriptionEn: b.descriptionEn || null,
    seasonOrDateFa: b.seasonOrDateFa,
    seasonOrDateEn: b.seasonOrDateEn || null,
    eventType: b.eventType || 'ritual',
    sourceReference: b.sourceReference || null,
    publicationStatus: b.publicationStatus || 'published',
    verificationStatus: b.verificationStatus || 'verified',
    isDemo: false,
    createdAt: nowIso(),
  } as EventRecord;
  db.events.push(event);
  commit();
  return event;
}

function createRoute(b: Body) {
  if (!b.titleFa || !b.descriptionFa) throw new Error('عنوان و توضیحات مسیر پیاده‌روی الزامی است.');
  const db = getDb();
  const route = {
    id: newId('route'),
    slug: uniqueSlug(db.routes, b.slug || defaultSlug('route')),
    titleFa: b.titleFa,
    titleEn: b.titleEn || null,
    descriptionFa: b.descriptionFa,
    descriptionEn: b.descriptionEn || null,
    durationMinutes: Number(b.durationMinutes) || 60,
    distanceKm: Number(b.distanceKm) || 1.5,
    difficulty: b.difficulty || 'easy',
    color: b.color || '#D6A83F',
    publicationStatus: 'published',
    verificationStatus: 'verified',
    isDemo: false,
    createdAt: nowIso(),
  } as RouteRow;
  db.routes.push(route);
  setRouteStops(route.id, Array.isArray(b.stops) ? b.stops : []);
  commit();
  return route;
}

function updateRoute(id: string, b: Body) {
  const db = getDb();
  const route = db.routes.find((r) => r.id === id);
  if (!route) throw new Error('مسیر موردنظر یافت نشد.');
  const { stops, ...fields } = stripImmutable(b);
  const payload: Body = { ...fields };
  if (payload.durationMinutes !== undefined) payload.durationMinutes = Number(payload.durationMinutes) || 60;
  if (payload.distanceKm !== undefined) payload.distanceKm = Number(payload.distanceKm) || 1.5;
  Object.assign(route, payload);
  if (Array.isArray(stops)) setRouteStops(id, stops);
  commit();
  return route;
}

function createMedia(b: Body) {
  if (!b.fileUrl || !b.titleFa) throw new Error('عنوان و آدرس رسانه الزامی است.');
  const db = getDb();
  const record = {
    id: newId('media'),
    placeId: b.placeId || null,
    storyId: b.storyId || null,
    mediaType: b.mediaType || 'recent_photo',
    fileUrl: b.fileUrl,
    titleFa: b.titleFa,
    titleEn: b.titleEn || null,
    captionFa: b.captionFa || null,
    captionEn: b.captionEn || null,
    captureDate: b.captureDate || null,
    photographerOrCreator: b.photographerOrCreator || null,
    sourceReference: b.sourceReference || null,
    publicationStatus: 'published',
    verificationStatus: 'verified',
    isDemo: false,
    createdAt: nowIso(),
  } as MediaRecord;
  db.media.push(record);
  commit();
  return record;
}

// Generic update for flat resources (layers, people, stories, events, media).
function updateFlat(collection: 'layers' | 'people' | 'events' | 'media', id: string, b: Body) {
  const db = getDb();
  const row = (db[collection] as { id: string }[]).find((r) => r.id === id);
  if (!row) throw new Error('رکورد موردنظر یافت نشد.');
  Object.assign(row, stripImmutable(b), collection === 'layers' || collection === 'people' ? { updatedAt: nowIso() } : {});
  commit();
  return row;
}

function updateStory(id: string, b: Body) {
  const db = getDb();
  const story = db.stories.find((s) => s.id === id);
  if (!story) throw new Error('داستان موردنظر یافت نشد.');
  const { placeIds, ...fields } = stripImmutable(b);
  Object.assign(story, fields);
  if (Array.isArray(placeIds)) setStoryPlaces(id, placeIds);
  commit();
  return story;
}

function updateContributionStatus(id: string, b: Body) {
  const db = getDb();
  const record = db.contributions.find((c) => c.id === id);
  if (!record) throw new Error('مشارکت موردنظر یافت نشد.');
  record.moderationStatus = b.moderationStatus;
  record.adminNotes = b.adminNotes ?? null;
  record.updatedAt = nowIso();
  syncApprovedContributionsToPlaces();
  commit();
  return record;
}

// Deletes mirror the ON DELETE rules of the old SQL schema.
function deleteRecord(resource: string, id: string) {
  const db = getDb();
  switch (resource) {
    case 'layers':
      db.layers = db.layers.filter((l) => l.id !== id);
      db.places.forEach((p) => {
        if (p.layerId === id) p.layerId = null;
      });
      break;
    case 'places':
      db.places = db.places.filter((p) => p.id !== id);
      db.placePeople = db.placePeople.filter((l) => l.placeId !== id);
      db.placeStories = db.placeStories.filter((l) => l.placeId !== id);
      db.routeStops = db.routeStops.filter((s) => s.placeId !== id);
      db.events.forEach((e) => {
        if (e.placeId === id) e.placeId = null;
      });
      db.media.forEach((m) => {
        if (m.placeId === id) m.placeId = null;
      });
      break;
    case 'people':
      db.people = db.people.filter((p) => p.id !== id);
      db.placePeople = db.placePeople.filter((l) => l.personId !== id);
      break;
    case 'stories':
      db.stories = db.stories.filter((s) => s.id !== id);
      db.placeStories = db.placeStories.filter((l) => l.storyId !== id);
      db.media.forEach((m) => {
        if (m.storyId === id) m.storyId = null;
      });
      break;
    case 'events':
      db.events = db.events.filter((e) => e.id !== id);
      break;
    case 'routes':
      db.routes = db.routes.filter((r) => r.id !== id);
      db.routeStops = db.routeStops.filter((s) => s.routeId !== id);
      break;
    case 'media':
      db.media = db.media.filter((m) => m.id !== id);
      break;
    default:
      throw new Error('Unknown resource');
  }
  commit();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Router: same URLs and verbs as the old Express server
// ---------------------------------------------------------------------------

export async function handleLocalRequest(method: string, rawPath: string, body?: Body): Promise<any> {
  await loadHosted();
  const verb = method.toUpperCase();
  const parts = rawPath.split('?')[0].split('/').filter(Boolean); // ['api','admin','places',':id']
  if (parts[0] !== 'api') throw new Error(`Unknown route: ${rawPath}`);

  const [, scope, resource, id] = parts;

  if (scope === 'public') {
    if (resource === 'map-bundle' && verb === 'GET') return getPublicMapBundle();
    if (resource === 'contributions' && verb === 'POST') return createContribution(body || {});
  }

  if (scope === 'admin') {
    if (resource === 'bundle' && verb === 'GET') return getAdminBundle();

    if (resource === 'contributions' && id && verb === 'PUT') {
      return updateContributionStatus(id, body || {});
    }

    if (verb === 'DELETE' && id) return deleteRecord(resource, id);

    const b = body || {};
    switch (resource) {
      case 'layers':
        if (verb === 'POST') return createLayer(b);
        if (verb === 'PUT' && id) return updateFlat('layers', id, b);
        break;
      case 'places':
        if (verb === 'POST') return createPlace(b);
        if (verb === 'PUT' && id) return updatePlace(id, b);
        break;
      case 'people':
        if (verb === 'POST') return createPerson(b);
        if (verb === 'PUT' && id) return updateFlat('people', id, b);
        break;
      case 'stories':
        if (verb === 'POST') return createStory(b);
        if (verb === 'PUT' && id) return updateStory(id, b);
        break;
      case 'events':
        if (verb === 'POST') return createEvent(b);
        if (verb === 'PUT' && id) return updateFlat('events', id, b);
        break;
      case 'routes':
        if (verb === 'POST') return createRoute(b);
        if (verb === 'PUT' && id) return updateRoute(id, b);
        break;
      case 'media':
        if (verb === 'POST') return createMedia(b);
        if (verb === 'PUT' && id) return updateFlat('media', id, b);
        break;
    }
  }

  throw new Error(`Unsupported request: ${verb} ${rawPath}`);
}
