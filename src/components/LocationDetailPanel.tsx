import { videoEmbedUrl } from '../utils/hostedMedia';
import { ShareMenu } from './ShareMenu';
import type { ReferenceItem } from '../types';
import { ReferenceList, parseRefs } from './ReferenceList';
import { ORG_TAG_FA } from '../types';
import { placeUrl } from '../utils/urls';
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  AudioLines,
  BookOpen,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  Navigation,
  Share2,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  AudioItem,
  EventRecord,
  Language,
  LayerRecord,
  PersonRecord,
  PhotoItem,
  PlacePersonLink,
  PlaceRecord,
  PlaceStoryLink,
  StoryRecord,
  VideoItem,
} from '../types';

interface LocationDetailPanelProps {
  lang: Language;
  place: PlaceRecord;
  layers: LayerRecord[];
  allPlaces: PlaceRecord[];
  people: PersonRecord[];
  stories: StoryRecord[];
  events: EventRecord[];
  placePeople: PlacePersonLink[];
  placeStories: PlaceStoryLink[];
  /** Neighbourhood whose boundary contains this place, if any. */
  neighbourhood?: PlaceRecord | null;
  onClose: () => void;
  onSelectPlace: (place: PlaceRecord) => void;
  onSelectStory: (story: StoryRecord) => void;
}

function safeParseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function computeDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function LocationDetailPanel({
  lang,
  place,
  layers,
  allPlaces,
  people,
  stories,
  events,
  placePeople,
  placeStories,
  neighbourhood = null,
  onClose,
  onSelectPlace,
  onSelectStory,
}: LocationDetailPanelProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showNearby, setShowNearby] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const primaryLayer = useMemo(
    () => layers.find((l) => l.id === place.layerId),
    [layers, place.layerId]
  );

  const additionalLayerIds = useMemo(
    () => safeParseJson<string[]>(place.additionalLayerIds, []),
    [place.additionalLayerIds]
  );

  const additionalLayers = useMemo(
    () => layers.filter((l) => additionalLayerIds.includes(l.id)),
    [layers, additionalLayerIds]
  );

  const references = useMemo(() => safeParseJson<ReferenceItem[]>(place.referenceLinks, []), [place.referenceLinks]);

  const historicalPhotos = useMemo(
    () => safeParseJson<PhotoItem[]>(place.historicalPhotos, []),
    [place.historicalPhotos]
  );

  const recentPhotos = useMemo(
    () => safeParseJson<PhotoItem[]>(place.recentPhotos, []),
    [place.recentPhotos]
  );

  const audioRecordings = useMemo(
    () => safeParseJson<AudioItem[]>(place.audioRecordings, []),
    [place.audioRecordings]
  );

  const videoLinks = useMemo(
    () => safeParseJson<VideoItem[]>(place.videoLinks, []),
    [place.videoLinks]
  );

  const relatedPeople = useMemo(() => {
    const links = placePeople.filter((pp) => pp.placeId === place.id);
    return links
      .map((l) => {
        const person = people.find((p) => p.id === l.personId);
        return person ? { person, roleFa: l.relationshipRoleFa } : null;
      })
      .filter(Boolean) as { person: PersonRecord; roleFa?: string | null }[];
  }, [place.id, placePeople, people]);

  const relatedStories = useMemo(() => {
    const links = placeStories.filter((ps) => ps.placeId === place.id);
    return links
      .map((l) => stories.find((s) => s.id === l.storyId))
      .filter(Boolean) as StoryRecord[];
  }, [place.id, placeStories, stories]);

  const relatedEvents = useMemo(
    () => events.filter((e) => e.placeId === place.id),
    [events, place.id]
  );

  const nearbyPlaces = useMemo(() => {
    return allPlaces
      .filter((p) => p.id !== place.id)
      .map((p) => ({
        place: p,
        distanceKm: computeDistanceKm(
          place.latitude,
          place.longitude,
          p.latitude,
          p.longitude
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 4);
  }, [allPlaces, place]);

  const shareUrl = placeUrl(place.slug);
  const osmUrl = `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=18/${place.latitude}/${place.longitude}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
    }
  };

  const handleShare = () => setShareOpen(true);

  const leadPhoto = recentPhotos[0] || historicalPhotos[0];

  return (
    <aside
      aria-label={lang === 'fa' ? 'جزئیات مکان' : 'Location Details'}
      className="absolute inset-0 md:inset-auto md:top-3 md:bottom-3 md:end-3 md:w-[420px] lg:w-[440px] bg-[#F5F2E9]/90 backdrop-blur-md md:rounded-xl border border-[#806B50]/30 flex flex-col z-[1000] overflow-hidden shadow-2xl"
    >
      {/* Top Bar of Detail Panel */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#806B50]/20 bg-[#EBE6DF]/60 shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#57534E] truncate">
          <span className="font-medium text-[#254B36]">
            {primaryLayer
              ? lang === 'fa'
                ? primaryLayer.nameFa
                : primaryLayer.nameEn || primaryLayer.nameFa
              : place.category}
          </span>
          {neighbourhood && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[#806B50]">
                {lang === 'fa' ? 'محله ' : 'Neighbourhood: '}
                {lang === 'fa' ? neighbourhood.nameFa : neighbourhood.nameEn || neighbourhood.nameFa}
              </span>
            </>
          )}
          {additionalLayers.map((al) => (
            <React.Fragment key={al.id}>
              <span aria-hidden="true">·</span>
              <span>{lang === 'fa' ? al.nameFa : al.nameEn || al.nameFa}</span>
            </React.Fragment>
          ))}
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">
            {place.latitude.toFixed(4)}°N, {place.longitude.toFixed(4)}°E
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#D6CEBE]/50 transition-colors shrink-0"
          aria-label={lang === 'fa' ? 'بستن پنل' : 'Close panel'}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Archival Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Demo Sample Transparency Notice (Strictly required so demo data is never mistaken for verified history) */}
        {(place.isDemo || place.verificationStatus === 'demo') && (
          <div className="p-3.5 rounded-lg bg-[#D6A83F]/15 border border-[#D6A83F]/50 text-xs text-[#5C4B3B] flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-[#806B50] shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-[#1C1917] block mb-0.5">
                {lang === 'fa'
                  ? 'رکورد نمونه آزمایشی (Demo Mode)'
                  : 'Demonstration Sample Record (Demo Mode)'}
              </strong>
              {lang === 'fa'
                ? 'این رکورد صرفاً جهت نمایش ساختار رابط کاربری سامانه «مردمنگار برزک» است و اطلاعات تاریخی تاییدشده محسوب نمی‌شود.'
                : 'This entry is a sample template demonstrating the interface and is not presented as verified historical documentation.'}
            </div>
          </div>
        )}

        {/* Title & Bilingual Subheading */}
        <div>
          <h2 className="text-2xl font-bold text-[#1C1917] leading-snug">
            {lang === 'fa' ? place.nameFa : place.nameEn || place.nameFa}
          </h2>
          {place.nameEn && lang === 'fa' && (
            <p className="text-sm font-display-en text-[#57534E] mt-1 dir-ltr text-right">
              {place.nameEn}
            </p>
          )}
          {place.nameFa && lang === 'en' && (
            <p className="text-sm text-[#57534E] mt-1">{place.nameFa}</p>
          )}
        </div>

        {/* Lead Photograph with Zero-Broken-Image Fallback */}
        {leadPhoto && (
          <figure className="rounded-lg overflow-hidden border border-[#806B50]/20 bg-[#EBE6DF]">
            {!failedImages[leadPhoto.url] ? (
              <img
                src={leadPhoto.url}
                alt={
                  (lang === 'fa' ? leadPhoto.captionFa : leadPhoto.captionEn) ||
                  place.nameFa
                }
                referrerPolicy="no-referrer"
                onError={() =>
                  setFailedImages((prev) => ({ ...prev, [leadPhoto.url]: true }))
                }
                className="w-full h-56 object-cover"
              />
            ) : (
              <div className="w-full h-48 bg-[#EBE6DF] flex flex-col items-center justify-center p-6 text-center text-[#806B50]">
                <ImageIcon className="w-8 h-8 mb-2 opacity-60" />
                <span className="text-xs font-medium">{place.nameFa}</span>
              </div>
            )}
            {(leadPhoto.captionFa || leadPhoto.captionEn) && (
              <figcaption className="px-3.5 py-2.5 text-xs text-[#57534E] bg-[#EBE6DF]/60 flex items-center justify-between gap-2">
                <span>
                  {lang === 'fa'
                    ? leadPhoto.captionFa
                    : leadPhoto.captionEn || leadPhoto.captionFa}
                </span>
                {leadPhoto.year && (
                  <span className="text-[#806B50] shrink-0">{leadPhoto.year}</span>
                )}
              </figcaption>
            )}
          </figure>
        )}

        {/* Primary Action Toolbar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <a
            href={osmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium hover:bg-[#1d3b2a] transition-colors whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span>{lang === 'fa' ? 'مشاهده در OSM' : 'Open in OSM'}</span>
          </a>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#EBE6DF] text-[#1C1917] hover:bg-[#D6CEBE] text-xs font-medium transition-colors whitespace-nowrap"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#254B36] shrink-0" />
                <span>{lang === 'fa' ? 'کپی شد' : 'Copied'}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'fa' ? 'کپی لینک' : 'Copy Link'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#EBE6DF] text-[#1C1917] hover:bg-[#D6CEBE] text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span>{lang === 'fa' ? 'اشتراک‌گذاری' : 'Share'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNearby((prev) => !prev)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              showNearby
                ? 'bg-[#806B50] text-[#F5F2E9]'
                : 'bg-[#EBE6DF] text-[#1C1917] hover:bg-[#D6CEBE]'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 shrink-0" />
            <span>{lang === 'fa' ? 'مکان‌های نزدیک' : 'Nearby'}</span>
          </button>
        </div>

        {/* Short Introduction & Full Description */}
        <div className="space-y-3 border-t border-[#806B50]/20 pt-5">
          <p className="text-sm font-medium text-[#254B36] leading-relaxed">
            {lang === 'fa' ? place.shortIntroFa : place.shortIntroEn || place.shortIntroFa}
          </p>
          <p className="text-sm text-[#292524] leading-loose whitespace-pre-line">
            {lang === 'fa'
              ? place.fullDescriptionFa
              : place.fullDescriptionEn || place.fullDescriptionFa}
          </p>
        </div>

        {/* Historical Information & Current Status */}
        {(place.historicalInfoFa || place.currentStatusFa) && (
          <dl className="space-y-4 border-t border-[#806B50]/20 pt-5 text-sm">
            {place.historicalInfoFa && (
              <div>
                <dt className="text-xs font-semibold text-[#806B50] mb-1">
                  {lang === 'fa' ? 'پیشینه و اطلاعات تاریخی' : 'Historical Information'}
                </dt>
                <dd className="text-[#292524] leading-relaxed">
                  {lang === 'fa'
                    ? place.historicalInfoFa
                    : place.historicalInfoEn || place.historicalInfoFa}
                </dd>
              </div>
            )}
            {place.currentStatusFa && (
              <div>
                <dt className="text-xs font-semibold text-[#806B50] mb-1">
                  {lang === 'fa' ? 'وضعیت کنونی' : 'Current Status'}
                </dt>
                <dd>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      place.currentStatusFa === 'فعال'
                        ? 'bg-[#254B36]/15 text-[#254B36]'
                        : place.currentStatusFa === 'تخریب‌شده'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-[#D6A83F]/30 text-[#7a5a0a]'
                    }`}
                  >
                    {lang === 'fa' ? place.currentStatusFa : place.currentStatusEn || place.currentStatusFa}
                  </span>
                </dd>
              </div>
            )}
          </dl>
        )}

        {/* Historical & Recent Photo Galleries */}
        {(historicalPhotos.length > 0 || recentPhotos.length > 1) && (
          <div className="space-y-3 border-t border-[#806B50]/20 pt-5">
            <h3 className="text-xs font-semibold text-[#806B50]">
              {lang === 'fa' ? 'نگارخانه تصاویر تاریخی و معاصر' : 'Historical & Recent Photographs'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[...historicalPhotos, ...recentPhotos].map((photo, idx) => (
                <div
                  key={`${photo.url}-${idx}`}
                  className="rounded-lg overflow-hidden border border-[#806B50]/20 bg-[#EBE6DF]"
                >
                  {!failedImages[photo.url] ? (
                    <img
                      src={photo.url}
                      alt={photo.captionFa || place.nameFa}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [photo.url]: true }))
                      }
                      className="w-full h-28 object-cover"
                    />
                  ) : (
                    <div className="w-full h-28 flex items-center justify-center text-[#806B50]">
                      <ImageIcon className="w-5 h-5 opacity-50" />
                    </div>
                  )}
                  <div className="p-2 text-[11px] text-[#57534E] truncate">
                    {lang === 'fa'
                      ? photo.captionFa || 'تصویر ثبت‌شده'
                      : photo.captionEn || photo.captionFa || 'Archival photo'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audio Recordings & Video Links */}
        {(audioRecordings.length > 0 || videoLinks.length > 0) && (
          <div className="space-y-3 border-t border-[#806B50]/20 pt-5">
            <h3 className="text-xs font-semibold text-[#806B50]">
              {lang === 'fa' ? 'روایت‌های صوتی و ویدیویی' : 'Audio Recordings & Videos'}
            </h3>
            {audioRecordings.map((aud, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-[#EBE6DF] border border-[#806B50]/20 space-y-2"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-[#1C1917]">
                  <AudioLines className="w-4 h-4 text-[#254B36]" />
                  <span>{lang === 'fa' ? aud.titleFa : aud.titleEn || aud.titleFa}</span>
                </div>
                <audio controls src={aud.url} className="w-full h-8" />
              </div>
            ))}
            {videoLinks.map((vid, i) => {
              const embed = videoEmbedUrl(vid.url);
              const title = lang === 'fa' ? vid.titleFa : vid.titleEn || vid.titleFa;
              return embed ? (
                <div key={i} className="space-y-1.5">
                  <div className="aspect-video rounded-lg overflow-hidden bg-black">
                    <iframe
                      src={embed}
                      title={title}
                      className="w-full h-full"
                      loading="lazy"
                      allow="fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="text-[11px] text-[#57534E] flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-[#254B36]" />
                    {title}
                  </div>
                </div>
              ) : (
                <a
                  key={i}
                  href={vid.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE] transition-colors text-xs font-medium text-[#1C1917]"
                >
                  <span className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-[#254B36]" />
                    {title}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#806B50]" />
                </a>
              );
            })}
          </div>
        )}

        {/* Related People */}
        {relatedPeople.length > 0 && (
          <div className="space-y-3 border-t border-[#806B50]/20 pt-5">
            <h3 className="text-xs font-semibold text-[#806B50] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'افراد و پیشه‌وران مرتبط' : 'Related People & Artisans'}</span>
            </h3>
            <div className="space-y-2.5">
              {relatedPeople.map(({ person, roleFa }) => (
                <div
                  key={person.id}
                  className="p-3.5 rounded-lg bg-[#EBE6DF]/70 border border-[#806B50]/20 space-y-1"
                >
                  <div className="text-sm font-semibold text-[#1C1917]">
                    {lang === 'fa' ? person.nameFa : person.nameEn || person.nameFa}
                  </div>
                  <div className="text-xs text-[#254B36]">
                    {lang === 'fa'
                      ? person.occupationFa
                      : person.occupationEn || person.occupationFa}
                    {roleFa ? ` · ${roleFa}` : ''}
                  </div>
                  <p className="text-xs text-[#57534E] leading-relaxed pt-1">
                    {lang === 'fa' ? person.bioFa : person.bioEn || person.bioFa}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Stories */}
        {relatedStories.length > 0 && (
          <div className="space-y-3 border-t border-[#806B50]/20 pt-5">
            <h3 className="text-xs font-semibold text-[#806B50] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'داستان‌ها و خاطرات مرتبط' : 'Related Stories & Memories'}</span>
            </h3>
            <div className="space-y-2.5">
              {relatedStories.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onSelectStory(st)}
                  className="w-full text-start p-3.5 rounded-lg bg-[#EBE6DF]/80 hover:bg-[#D6CEBE]/70 border border-[#806B50]/20 transition-colors space-y-1"
                >
                  <div className="text-sm font-semibold text-[#254B36]">
                    {lang === 'fa' ? st.titleFa : st.titleEn || st.titleFa}
                  </div>
                  <p className="text-xs text-[#57534E] line-clamp-2 leading-relaxed">
                    {lang === 'fa' ? st.summaryFa : st.summaryEn || st.summaryFa}
                  </p>
                  <div className="text-[11px] text-[#806B50] pt-1">
                    {lang === 'fa' ? 'مطالعه روایت کامل ←' : 'Read full story →'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Related Seasonal Events */}
        {relatedEvents.length > 0 && (
          <div className="space-y-3 border-t border-[#806B50]/20 pt-5">
            <h3 className="text-xs font-semibold text-[#806B50] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'رویدادها و آیین‌های مرتبط' : 'Related Cultural Events'}</span>
            </h3>
            <div className="space-y-2">
              {relatedEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-lg bg-[#EBE6DF]/60 border border-[#806B50]/20 space-y-1"
                >
                  <div className="text-sm font-medium text-[#1C1917]">
                    {lang === 'fa' ? ev.titleFa : ev.titleEn || ev.titleFa}
                  </div>
                  <div className="text-xs text-[#806B50]">
                    {lang === 'fa' ? ev.seasonOrDateFa : ev.seasonOrDateEn || ev.seasonOrDateFa}
                  </div>
                  <p className="text-xs text-[#57534E] leading-relaxed">
                    {lang === 'fa' ? ev.descriptionFa : ev.descriptionEn || ev.descriptionFa}
                  </p>
                  <ReferenceList lang={lang} refs={parseRefs(ev.referenceLinks)} heading={false} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nearby Locations Drawer */}
        {showNearby && nearbyPlaces.length > 0 && (
          <div className="space-y-2.5 border-t border-[#806B50]/20 pt-5">
            <h3 className="text-xs font-semibold text-[#254B36] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>
                {lang === 'fa' ? 'مکان‌های نزدیک در برزک' : 'Nearby Locations in Barzok'}
              </span>
            </h3>
            <div className="space-y-2">
              {nearbyPlaces.map(({ place: np, distanceKm }) => (
                <button
                  key={np.id}
                  type="button"
                  onClick={() => onSelectPlace(np)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE] transition-colors text-start"
                >
                  <div className="truncate pe-3">
                    <div className="text-xs font-semibold text-[#1C1917] truncate">
                      {lang === 'fa' ? np.nameFa : np.nameEn || np.nameFa}
                    </div>
                    <div className="text-[11px] text-[#57534E] truncate">{np.category}</div>
                  </div>
                  <span className="text-xs font-mono-num text-[#254B36] shrink-0">
                    {distanceKm < 1
                      ? `${Math.round(distanceKm * 1000)} m`
                      : `${distanceKm.toFixed(2)} km`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {references.length > 0 && (
          <div className="border-t border-[#806B50]/20 pt-5">
            <ReferenceList lang={lang} refs={references} />
          </div>
        )}

        {/* Provenance: everything on the map is documented by the lodge */}
        <div className="border-t border-[#806B50]/20 pt-5 text-xs text-[#57534E] space-y-1.5">
          <div>
            <span className="inline-block px-2.5 py-1 rounded-full bg-[#254B36] text-[#F5F2E9] font-semibold">
              {lang === 'fa' ? ORG_TAG_FA : 'Documented by Khaneh Barzok'}
            </span>
          </div>
          {place.sourceReference && /مشارکت مردمی/.test(place.sourceReference) && (
            <div>
              <span className="font-semibold text-[#1C1917]">{lang === 'fa' ? 'منبع: ' : 'Source: '}</span>
              <span>{place.sourceReference}</span>
            </div>
          )}
          {place.documentationDate && (
            <div>
              <span className="font-semibold text-[#1C1917]">
                {lang === 'fa' ? 'تاریخ مستندسازی: ' : 'Documentation Date: '}
              </span>
              <span>{place.documentationDate}</span>
            </div>
          )}
          {place.contributorApproved && place.contributorName && (
            <div>
              <span className="font-semibold text-[#1C1917]">
                {lang === 'fa' ? 'مشارکت‌کننده: ' : 'Contributor: '}
              </span>
              <span>{place.contributorName}</span>
            </div>
          )}
          <div className="pt-1 text-[11px] text-[#806B50] font-mono-num break-all">
            /place/{place.slug}
          </div>
        </div>
      </div>
      {shareOpen && (
        <ShareMenu
          lang={lang}
          title={lang === 'fa' ? place.nameFa : place.nameEn || place.nameFa}
          text={lang === 'fa' ? place.shortIntroFa : place.shortIntroEn || place.shortIntroFa}
          url={shareUrl}
          onClose={() => setShareOpen(false)}
        />
      )}
    </aside>
  );
}
