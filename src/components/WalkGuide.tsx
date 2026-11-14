import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, AudioLines, ChevronLeft, ChevronRight, List, LocateFixed, MapPinned, Navigation, Play, X } from 'lucide-react';
import type { AudioItem, Language, PlaceRecord, RouteRecord } from '../types';
import type { GeoPosition, GeoStatus } from '../hooks/useGeolocation';
import { bearingDegrees, compassWord, distanceMeters, formatDistance, formatNumber, matchToTrack } from '../utils/geo';

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
  followUser: boolean;
  onFollowChange: (follow: boolean) => void;
  onClose: () => void;
}

const ARRIVED_METERS = 25;
const OFF_TRACK_METERS = 60;

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
  followUser,
  onFollowChange,
  onClose,
}: WalkGuideProps) {
  const fa = lang === 'fa';
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);

  const stops = useMemo(() => {
    const byId = new Map(allPlaces.map((p) => [p.id, p]));
    return [...route.stops]
      .sort((a, b) => a.stopOrder - b.stopOrder)
      .map((s) => ({ stop: s, place: byId.get(s.placeId) }))
      .filter((x): x is { stop: typeof x.stop; place: PlaceRecord } => Boolean(x.place));
  }, [route, allPlaces]);

  useEffect(() => {
    setIndex(0);
    setStarted(false);
  }, [route.id]);

  const begin = (at = 0) => {
    setIndex(at);
    setStarted(true);
    onStartGps();
    onFollowChange(true);
  };

  const current = stops[index];

  // Select the current stop so the map pans to it and the detail panel can show photos and story.
  const currentPlaceId = current?.place.id;
  useEffect(() => {
    if (current && started) onFocusPlace(current.place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlaceId, started]);

  // Hooks below must run on every render, so they come before the early return.
  const track = route.track ?? [];
  const progress = useMemo(
    () => (position ? matchToTrack({ lat: position.lat, lng: position.lng }, track) : null),
    [position?.lat, position?.lng, route.id]
  );

  // Walking forward: when the visitor reaches one of the next stops, show that stop automatically.
  useEffect(() => {
    if (!started || !position) return;
    for (let i = index + 1; i <= Math.min(stops.length - 1, index + 3); i++) {
      const p = stops[i].place;
      const d = distanceMeters(position, { lat: p.latitude, lng: p.longitude });
      if (d <= Math.max(ARRIVED_METERS, position.accuracy * 0.8)) {
        setIndex(i);
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, started]);

  if (!current) return null;
  const { place, stop } = current;

  const here = position ? { lat: position.lat, lng: position.lng } : null;
  const target = { lat: place.latitude, lng: place.longitude };
  const dist = here ? distanceMeters(here, target) : null;
  const arrived = dist !== null && dist <= Math.max(ARRIVED_METERS, (position?.accuracy ?? 0) * 0.8);
  const dir = here ? compassWord(bearingDegrees(here, target), lang) : null;

  // Nearest stop other than the current one: offered as a jump when the guest has walked ahead.
  const nearest = (() => {
    if (!here) return null;
    let best: { i: number; d: number } | null = null;
    stops.forEach((s, i) => {
      const d = distanceMeters(here, { lat: s.place.latitude, lng: s.place.longitude });
      if (!best || d < best.d) best = { i, d };
    });
    return best as { i: number; d: number } | null;
  })();

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

  const diffLabel: Record<string, string> = fa
    ? { easy: 'آسان', moderate: 'متوسط', hard: 'سخت' }
    : { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' };

  if (!started) {
    return (
      <div
        className="absolute inset-x-2 bottom-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[30rem] z-30 bg-[#F5F2E9] border border-[#806B50]/35 rounded-xl shadow-xl overflow-hidden"
        dir={fa ? 'rtl' : 'ltr'}
        role="region"
        aria-label={fa ? 'مسیر پیاده‌روی' : 'Walking route'}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#254B36] text-[#F5F2E9] text-xs">
          <span className="font-semibold truncate">{fa ? route.titleFa : route.titleEn || route.titleFa}</span>
          <button type="button" onClick={onClose} aria-label={fa ? 'بستن' : 'Close'} className="p-1 rounded hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 space-y-2.5">
          <div className="flex items-center gap-3 text-xs text-[#1C1917]">
            <span className="px-2 py-1 rounded bg-[#EBE6DF] font-semibold">
              {formatNumber(route.distanceKm, lang)} {fa ? 'کیلومتر' : 'km'}
            </span>
            <span className="px-2 py-1 rounded bg-[#EBE6DF] font-semibold">
              {formatNumber(route.durationMinutes, lang)} {fa ? 'دقیقه' : 'min'}
            </span>
            <span className="px-2 py-1 rounded bg-[#EBE6DF] font-semibold">
              {diffLabel[route.difficulty] ?? route.difficulty}
            </span>
            <span className="px-2 py-1 rounded bg-[#EBE6DF] font-semibold">
              {formatNumber(stops.length, lang)} {fa ? 'ایستگاه' : 'stops'}
            </span>
          </div>
          <ol className="max-h-44 overflow-y-auto space-y-1 pe-1">
            {stops.map((s, i) => {
              const hasAudio = parseAudio(s.place.audioRecordings).length > 0 || Boolean(s.stop.audioUrl);
              return (
                <li key={s.stop.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setIndex(i);
                      onFocusPlace(s.place);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-start text-xs hover:bg-[#EBE6DF] ${
                      i === index ? 'bg-[#EBE6DF]' : ''
                    }`}
                  >
                    <span className="w-6 h-6 shrink-0 rounded-full bg-[#D6A83F] text-[#1C1917] font-bold text-[11px] flex items-center justify-center">
                      {formatNumber(i + 1, lang)}
                    </span>
                    <span className="flex-1 truncate font-medium text-[#1C1917]">
                      {fa ? s.place.nameFa : s.place.nameEn || s.place.nameFa}
                    </span>
                    {hasAudio && <AudioLines className="w-3.5 h-3.5 text-[#254B36] shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            onClick={() => begin(index)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-sm font-semibold"
          >
            <Play className="w-4 h-4" />
            {index === 0
              ? fa ? 'شروع پیاده‌روی و دنبال کردن مسیر' : 'Start walking and follow the route'
              : fa ? `شروع از ایستگاه ${formatNumber(index + 1, lang)}` : `Start from stop ${index + 1}`}
          </button>
        </div>
      </div>
    );
  }

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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onFollowChange(!followUser)}
            aria-pressed={followUser}
            title={fa ? 'دنبال کردن موقعیت من روی نقشه' : 'Keep the map centred on me'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold whitespace-nowrap shrink-0 ${followUser ? 'bg-[#D6A83F] text-[#1C1917]' : 'hover:bg-white/10'}`}
          >
            <LocateFixed className="w-3.5 h-3.5" />
            {fa ? 'دنبال کردن' : 'Follow'}
          </button>
          <button type="button" onClick={() => setStarted(false)} title={fa ? 'فهرست ایستگاه‌ها' : 'Stop list'} className="p-1 rounded hover:bg-white/10">
            <List className="w-4 h-4" />
          </button>
          <button type="button" onClick={onClose} aria-label={fa ? 'پایان' : 'End'} className="p-1 rounded hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
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

        {/* Progress along the recorded track + off-route warning */}
        {geoStatus === 'active' && progress && (
          <div className="space-y-1">
            {progress.offTrack > OFF_TRACK_METERS ? (
              <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 bg-[#D6A83F]/25 text-[#1C1917]">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#B8860B]" />
                {fa
                  ? `از مسیر ${formatDistance(progress.offTrack, lang)} دور شده‌اید`
                  : `You are ${formatDistance(progress.offTrack, lang)} away from the route`}
              </div>
            ) : (
              <>
                <div className="h-1.5 rounded-full bg-[#EBE6DF] overflow-hidden">
                  <div
                    className="h-full bg-[#254B36]"
                    style={{ width: `${Math.min(100, (progress.along / progress.total) * 100)}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#806B50]">
                  {fa
                    ? `${formatDistance(progress.along, lang)} رفته‌اید، ${formatDistance(Math.max(0, progress.total - progress.along), lang)} مانده`
                    : `${formatDistance(progress.along, lang)} walked, ${formatDistance(Math.max(0, progress.total - progress.along), lang)} to go`}
                </div>
              </>
            )}
          </div>
        )}

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
