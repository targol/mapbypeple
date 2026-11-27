import React, { useState } from 'react';
import { ChevronDown, List, X } from 'lucide-react';
import type { Language, LayerRecord, PlaceRecord } from '../types';

/**
 * Compact list of the places currently shown on the map (search / layer / neighbourhood filter).
 * Rows are one line; tapping a row opens its short description.
 */
export function ResultsPanel({
  lang,
  places,
  layers,
  hoodByPlace,
  selectedId,
  open,
  onOpenChange,
  onSelect,
  side = 'left',
}: {
  lang: Language;
  places: PlaceRecord[];
  layers: LayerRecord[];
  hoodByPlace: Record<string, PlaceRecord>;
  selectedId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (p: PlaceRecord) => void;
  side?: 'left' | 'right';
}) {
  const pos = side === 'right' ? 'right-3' : 'start-3';
  const [expanded, setExpanded] = useState<string | null>(null);
  const fa = lang === 'fa';
  const layerOf = (id: string | null | undefined) => layers.find((l) => l.id === id);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={`absolute top-3 ${pos} z-[500] flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F5F2E9]/95 border border-[#806B50]/35 shadow-md text-xs font-semibold text-[#254B36]`}
      >
        <List className="w-4 h-4" />
        {fa ? `فهرست (${places.length})` : `List (${places.length})`}
      </button>
    );
  }

  return (
    <aside
      data-testid="results-panel"
      className={`absolute top-3 ${pos} z-[500] w-72 max-w-[calc(100%-24px)] max-h-[calc(100%-13rem)] min-h-24 flex flex-col rounded-xl bg-[#F5F2E9]/97 border border-[#806B50]/35 shadow-lg overflow-hidden`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#806B50]/20">
        <span className="text-xs font-bold text-[#1C1917]">{fa ? `نتایج (${places.length})` : `Results (${places.length})`}</span>
        <button type="button" onClick={() => onOpenChange(false)} aria-label={fa ? 'بستن' : 'Close'} className="p-1 rounded hover:bg-[#EBE6DF]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="overflow-y-auto divide-y divide-[#806B50]/10">
        {places.length === 0 && <li className="p-4 text-xs text-[#806B50]">{fa ? 'موردی پیدا نشد.' : 'Nothing found.'}</li>}
        {places.map((p) => {
          const layer = layerOf(p.layerId);
          const hood = hoodByPlace[p.id];
          const isOpen = expanded === p.id;
          return (
            <li key={p.id} className={selectedId === p.id ? 'bg-[#D6A83F]/20' : ''}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : p.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-2 px-3 py-2 text-start hover:bg-[#EBE6DF]/70"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: layer?.color || '#806B50' }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-[#1C1917] truncate">{fa ? p.nameFa : p.nameEn || p.nameFa}</span>
                  <span className="block text-[10px] text-[#806B50] truncate">
                    {layer ? (fa ? layer.nameFa : layer.nameEn || layer.nameFa) : ''}
                    {hood ? ` · ${hood.nameFa}` : ''}
                  </span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#806B50] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-[11px] leading-relaxed text-[#57534E] line-clamp-5">{p.shortIntroFa}</p>
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    className="px-3 py-1.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-[11px] font-semibold"
                  >
                    {fa ? 'نمایش روی نقشه و جزئیات' : 'Show on map & details'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
