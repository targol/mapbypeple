import React, { useEffect, useMemo, useState } from 'react';
import { AudioLines, ChevronLeft, ChevronRight, MapPinned, Navigation, X } from 'lucide-react';
import type { AudioItem, Language, PlaceRecord, RouteRecord } from '../types';
import type { GeoPosition, GeoStatus } from '../hooks/useGeolocation';
import { bearingDegrees, compassWord, distanceMeters, formatDistance, formatNumber } from '../utils/geo';

interface WalkGuideProps {
  lang: Language;
  route: RouteRecord;
  allPlaces: PlaceRecord[];
  position: GeoPosition | null;
  geoStatus: GeoStatus;
  onStartGps: () => void;
  /** Pan the map to the stop (does not open the detail panel). */
  onFocusPlace: (place: PlaceRecord) => void;
  onOpenDetails: (place: PlaceRecord) => void;
  onClose: () => void;
}

const ARRIVED_METERS = 25;

function parseAudio(raw: string | undefined): AudioItem[] {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Bottom card for a guest walking a route: which stop is next, how far and in which direction
 * it is (when GPS is on), the story text and the audio player for that stop.
 */
export function WalkGuide({
  lang,
  route,
  allPlaces,
  position,
  geoStatus,
  onStartGps,
  onFocusPlace,
  onOpenDetails,
  onClose,
}: WalkGuideProps) {
  const fa = lang === 'fa';
  const [index, setIndex] = useState(0);

  const stops = useMemo(() => {
    const byId = new Map(allPlaces.map((p) => [p.id, p]));
    return [...route.stops]
      .sort((a, b) => a.stopOrder - b.stopOrder)
      .map((s) => ({ stop: s, place: byId.get(s.placeId) }))
      .filter((x): x is { stop: typeof x.stop; place: PlaceRecord } => Boolean(x.place));
  }, [route, allPlaces]);

  useEffect(() => setIndex(0), [route.id]);

  const current = stops[index];

  // Select the current stop so the map pans to it and the detail panel can show photos and story.
  const currentPlaceId = current?.place.id;
  useEffect(() => {
    if (current) onFocusPlace(current.place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlaceId]);

  if (!current) return null;
  const { place, stop } = current;

  const here = position ? { lat: position.lat, lng: position.lng } : null;
  const target = { lat: place.latitude, lng: place.longitude };
  const dist = here ? distanceMeters(here, target) : null;
  const arrived = dist !== null && dist <= Math.max(ARRIVED_METERS, (position?.accuracy ?? 0) * 0.8);
  const dir = here ? compassWord(bearingDegrees(here, target), lang) : null;

  // Nearest stop other than the current one: offered as a jump when the guest has walked ahead.
  const nearest = useMemo(() => {
    if (!here) return null;
    let best: { i: number; d: number } | null = null;
    stops.forEach((s, i) => {
      const d = distanceMeters(here, { lat: s.place.latitude, lng: s.place.longitude });
      if (!best || d < best.d) best = { i, d };
    });
    return best as { i: number; d: number } | null;
  }, [here?.lat, here?.lng, stops]);

  const audios: AudioItem[] = [
    ...(stop.audioUrl ? [{ url: stop.audioUrl, titleFa: place.nameFa } as AudioItem] : []),
    ...parseAudio(place.audioRecordings),
  ];
  const name = fa ? place.nameFa : place.nameEn || place.nameFa;
  const note = fa ? stop.noteFa : stop.noteEn || stop.noteFa;
  const intro = (fa ? place.shortIntroFa : place.shortIntroEn || place.shortIntroFa) || '';
  const n = (x: number) => formatNumber(x, lang);
  const Prev = fa ? ChevronRight : ChevronLeft;
  const Next = fa ? ChevronLeft : ChevronRight;

  return (
    <div
      className="absolute inset-x-2 bottom-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[30rem] z-30 bg-[#F5F2E9] border border-[#806B50]/35 rounded-xl shadow-xl overflow-hidden"
      dir={fa ? 'rtl' : 'ltr'}
      role="region"
      aria-label={fa ? 'راهنمای پیاده‌روی' : 'Walk guide'}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#254B36] text-[#F5F2E9] text-xs">
        <span className="font-semibold truncate">
          {fa ? route.titleFa : route.titleEn || route.titleFa}
        </span>
        <button type="button" onClick={onClose} aria-label={fa ? 'پایان' : 'End'} className="p-1 rounded hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 shrink-0 rounded-full bg-[#D6A83F] text-[#1C1917] font-bold text-sm flex items-center justify-center">
            {n(index + 1)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-[#806B50]">
              {fa ? `ایستگاه ${n(index + 1)} از ${n(stops.length)}` : `Stop ${index + 1} of ${stops.length}`}
            </div>
            <h3 className="text-base font-bold text-[#1C1917] leading-snug">{name}</h3>
          </div>
        </div>

        {/* GPS guidance */}
        {geoStatus === 'active' && dist !== null ? (
          <div
            className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
              arrived ? 'bg-[#254B36] text-[#F5F2E9]' : 'bg-[#EBE6DF] text-[#1C1917]'
            }`}
          >
            <Navigation className="w-4 h-4 shrink-0" />
            <span>
              {arrived
                ? fa
                  ? 'رسیدید! داستان این‌جا را بشنوید.'
                  : 'You have arrived. Listen to the story of this place.'
                : fa
                ? `${formatDistance(dist, lang)} تا این ایستگاه، به سمت ${dir}`
                : `${formatDistance(dist, lang)} to this stop, heading ${dir}`}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onStartGps}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold rounded-lg px-3 py-2 bg-[#EBE6DF] text-[#254B36] hover:bg-[#D6CEBE]"
          >
            <MapPinned className="w-4 h-4" />
            {geoStatus === 'requesting'
              ? fa ? 'در انتظار موقعیت مکانی…' : 'Waiting for location…'
              : geoStatus === 'denied'
              ? fa ? 'دسترسی به مکان رد شد؛ در تنظیمات مرورگر مجاز کنید' : 'Location blocked — allow it in browser settings'
              : geoStatus === 'unavailable'
              ? fa ? 'این دستگاه موقعیت‌یاب ندارد' : 'Location is not available on this device'
              : fa ? 'روشن کردن موقعیت من (GPS)' : 'Turn on my location (GPS)'}
          </button>
        )}

        {nearest && nearest.i !== index && nearest.d <= ARRIVED_METERS * 2 && (
          <button
            type="button"
            onClick={() => setIndex(nearest.i)}
            className="w-full text-xs rounded-lg px-3 py-1.5 border border-[#D6A83F] text-[#1C1917] bg-[#D6A83F]/15"
          >
            {fa ? `شما کنار ایستگاه ${n(nearest.i + 1)} هستید — نمایش آن` : `You are next to stop ${nearest.i + 1} — show it`}
          </button>
        )}

        {note && <p className="text-xs text-[#57534E] leading-relaxed">{note}</p>}
        {!note && intro && <p className="text-xs text-[#57534E] leading-relaxed line-clamp-3">{intro}</p>}

        {audios.length > 0 ? (
          <div className="space-y-1.5">
            {audios.map((a, i) => (
              <div key={i} className="rounded-lg bg-white border border-[#806B50]/20 p-2">
                <div className="flex items-center gap-1.5 text-[11px] text-[#254B36] font-semibold mb-1">
                  <AudioLines className="w-3.5 h-3.5" />
                  <span className="truncate">{fa ? a.titleFa : a.titleEn || a.titleFa}</span>
                </div>
                <audio controls preload="none" src={a.url} className="w-full h-9" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-[#806B50] flex items-center gap-1.5">
            <AudioLines className="w-3.5 h-3.5" />
            {fa ? 'روایت صوتی این مکان به‌زودی اضافه می‌شود.' : 'The audio story for this place is coming soon.'}
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpenDetails(place)}
          className="text-[11px] font-semibold text-[#254B36] underline"
        >
          {fa ? 'عکس‌ها و متن کامل این مکان' : 'Photos and full text'}
        </button>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#EBE6DF] text-xs font-medium disabled:opacity-40"
          >
            <Prev className="w-4 h-4" />
            {fa ? 'قبلی' : 'Previous'}
          </button>
          <button
            type="button"
            disabled={index >= stops.length - 1}
            onClick={() => setIndex((i) => Math.min(stops.length - 1, i + 1))}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium disabled:opacity-40"
          >
            {fa ? 'ایستگاه بعدی' : 'Next stop'}
            <Next className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
