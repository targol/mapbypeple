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
