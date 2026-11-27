import React from 'react';
import { MapPin, Users, X } from 'lucide-react';
import type { Language, PersonRecord, PlaceRecord, StoryRecord } from '../types';
import { ReferenceList, parseRefs } from './ReferenceList';

/** Detail of a story or a person, shown in the main area next to the map (same spot as the place panel). */
export function InfoDrawer({
  lang,
  story,
  person,
  places,
  onClose,
  onSelectPlace,
}: {
  lang: Language;
  story?: StoryRecord | null;
  person?: PersonRecord | null;
  places: PlaceRecord[];
  onClose: () => void;
  onSelectPlace: (p: PlaceRecord) => void;
}) {
  const fa = lang === 'fa';
  const item = story || person;
  if (!item) return null;
  return (
    <aside
      data-testid="info-drawer"
      className="absolute inset-0 md:inset-auto md:top-3 md:bottom-3 md:end-3 md:w-[26rem] bg-[#F5F2E9]/90 backdrop-blur-md md:rounded-xl border border-[#806B50]/30 shadow-2xl z-[1000] overflow-y-auto"
    >
      <div className="sticky top-0 flex items-center justify-between gap-3 px-5 py-3 bg-[#254B36] text-[#F5F2E9]">
        <h2 className="text-sm font-bold truncate">
          {story ? (fa ? story.titleFa : story.titleEn || story.titleFa) : fa ? person!.nameFa : person!.nameEn || person!.nameFa}
        </h2>
        <button type="button" onClick={onClose} aria-label={fa ? 'بستن' : 'Close'} className="p-1 rounded hover:bg-white/10 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-4">
        {story && (
          <>
            {story.imageUrl && <img src={story.imageUrl} alt="" referrerPolicy="no-referrer" className="w-full max-h-56 object-cover rounded-lg" />}
            <div className="text-xs text-[#806B50]">
              {story.narratorName || (fa ? 'راوی محلی' : 'Local narrator')}
              {story.recordedDate ? ` · ${story.recordedDate}` : ''}
            </div>
            {story.audioUrl && <audio controls preload="none" src={story.audioUrl} className="w-full h-9" />}
            <p className="text-sm leading-loose text-[#292524] whitespace-pre-line">{fa ? story.contentFa : story.contentEn || story.contentFa}</p>
            <ReferenceList lang={lang} refs={parseRefs(story.referenceLinks)} />
          </>
        )}
        {person && (
          <>
            <div className="flex items-center gap-4">
              {person.avatarUrl ? (
                <img src={person.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-20 h-20 rounded-full object-cover border border-[#806B50]/30" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#254B36] text-[#F5F2E9] flex items-center justify-center">
                  <Users className="w-8 h-8" />
                </div>
              )}
              <div className="text-sm font-semibold text-[#254B36]">{fa ? person.occupationFa : person.occupationEn || person.occupationFa}</div>
            </div>
            <p className="text-sm leading-loose text-[#292524] whitespace-pre-line">{fa ? person.bioFa : person.bioEn || person.bioFa}</p>
            <ReferenceList lang={lang} refs={parseRefs(person.referenceLinks)} />
          </>
        )}
        {places.length > 0 && (
          <div className="pt-3 border-t border-[#806B50]/20 space-y-2">
            <div className="text-xs font-semibold text-[#57534E]">{fa ? 'مکان‌های مرتبط (روی نقشه نشان داده شده‌اند)' : 'Linked places (shown on the map)'}</div>
            <div className="flex flex-wrap gap-2">
              {places.map((lp) => (
                <button
                  key={lp.id}
                  type="button"
                  onClick={() => onSelectPlace(lp)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#806B50]/25 text-xs font-semibold text-[#254B36] hover:bg-[#EBE6DF]"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {fa ? lp.nameFa : lp.nameEn || lp.nameFa}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
