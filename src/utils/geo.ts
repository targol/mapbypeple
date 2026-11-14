import type { Language } from '../types';

const R = 6371008.8; // mean Earth radius in metres
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Initial compass bearing from a to b, 0° = north, clockwise. */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const DIRECTIONS = {
  fa: ['شمال', 'شمال‌شرق', 'شرق', 'جنوب‌شرق', 'جنوب', 'جنوب‌غرب', 'غرب', 'شمال‌غرب'],
  en: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'],
};

export function compassWord(bearing: number, lang: Language): string {
  return DIRECTIONS[lang][Math.round(bearing / 45) % 8];
}

export function formatDistance(meters: number, lang: Language): string {
  const locale = lang === 'fa' ? 'fa-IR' : 'en-US';
  if (meters < 1000) {
    const rounded = meters < 100 ? Math.round(meters / 5) * 5 : Math.round(meters / 10) * 10;
    return `${rounded.toLocaleString(locale)} ${lang === 'fa' ? 'متر' : 'm'}`;
  }
  return `${(meters / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} ${lang === 'fa' ? 'کیلومتر' : 'km'}`;
}

export function formatNumber(n: number, lang: Language): string {
  return n.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US');
}

export interface TrackMatch {
  /** Distance from the point to the closest spot on the track, in metres. */
  offTrack: number;
  /** Metres walked along the track up to that closest spot. */
  along: number;
  total: number;
}

/** Closest point on a [lat, lng] polyline (flat local projection: accurate enough for a village walk). */
export function matchToTrack(point: LatLng, track: [number, number][]): TrackMatch | null {
  if (track.length < 2) return null;
  const kx = Math.cos(toRad(point.lat)) * 111320;
  const ky = 110574;
  const xy = track.map(([lat, lng]) => [(lng - point.lng) * kx, (lat - point.lat) * ky] as const);
  let best = { d: Infinity, along: 0 };
  let acc = 0;
  for (let i = 0; i < xy.length - 1; i++) {
    const [ax, ay] = xy[i];
    const [bx, by] = xy[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const segLen = Math.sqrt(len2);
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best.d) best = { d, along: acc + t * segLen };
    acc += segLen;
  }
  return { offTrack: best.d, along: best.along, total: acc };
}
