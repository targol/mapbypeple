import type { AudioItem, PhotoItem, PlaceRecord, VideoItem } from '../types';

/** What media.json holds for one place. Files live in the WordPress media library (any URL works). */
export interface PlaceMedia {
  photos?: PhotoItem[];
  audio?: AudioItem[];
  videos?: VideoItem[];
}
export type MediaManifest = Record<string, PlaceMedia>;

function parse<T>(raw: string | undefined, fallback: T): T {
  try {
    const v = JSON.parse(raw || '');
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

const addUnique = <T extends { url: string }>(base: T[], extra: T[] | undefined, front = false): T[] => {
  const fresh = (extra ?? []).filter((e) => e.url && !base.some((b) => b.url === e.url));
  return front ? [...fresh, ...base] : [...base, ...fresh];
};

/** Fetch a JSON file that sits next to index.html; missing or broken files are ignored. */
export async function fetchHostedJson<T>(file: string): Promise<T | null> {
  try {
    const res = await fetch(`${file}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Merge media.json (and the older audio.json) into the places, by place id.
 * Photos from media.json come first, so the lead photo can be one from WordPress.
 */
export async function attachHostedMedia(places: PlaceRecord[]): Promise<void> {
  const [media, audioOnly] = await Promise.all([
    fetchHostedJson<MediaManifest>('media.json'),
    fetchHostedJson<Record<string, AudioItem[]>>('audio.json'),
  ]);
  if (!media && !audioOnly) return;
  for (const place of places) {
    const m = media?.[place.id];
    const a = audioOnly?.[place.id];
    if (!m && !a) continue;
    if (m?.photos?.length) {
      place.recentPhotos = JSON.stringify(addUnique(parse<PhotoItem[]>(place.recentPhotos, []), m.photos, true));
    }
    const audio = addUnique(addUnique(parse<AudioItem[]>(place.audioRecordings, []), m?.audio), a);
    if (audio.length) place.audioRecordings = JSON.stringify(audio);
    if (m?.videos?.length) {
      place.videoLinks = JSON.stringify(addUnique(parse<VideoItem[]>(place.videoLinks, []), m.videos));
    }
  }
}

/** Embeddable player URL for Aparat and YouTube links; null for anything else. */
export function videoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'aparat.com') {
      const m = u.pathname.match(/\/v\/([A-Za-z0-9]+)/);
      return m ? `https://www.aparat.com/video/video/embed/videohash/${m[1]}/vt/frame` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v');
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
  } catch {
    // not a URL
  }
  return null;
}
