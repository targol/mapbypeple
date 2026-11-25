import React from 'react';
import type { Language, ReferenceItem } from '../types';

const LABEL: Record<ReferenceItem['kind'], string> = { article: 'مقاله', book: 'کتاب', website: 'وب‌سایت', other: 'منبع' };

export function parseRefs(v: unknown): ReferenceItem[] {
  try {
    const x = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(x) ? (x as ReferenceItem[]) : [];
  } catch {
    return [];
  }
}

export function ReferenceList({ lang, refs, heading = true }: { lang: Language; refs: ReferenceItem[]; heading?: boolean }) {
  if (refs.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {heading && <h3 className="text-xs font-semibold text-[#254B36]">{lang === 'fa' ? 'منابع و مطالعه‌ی بیشتر' : 'Sources & further reading'}</h3>}
      <ul className="space-y-1.5 text-xs">
        {refs.map((r, i) => (
          <li key={i} className="flex gap-1.5 items-baseline">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EBE6DF] text-[#806B50] shrink-0">{LABEL[r.kind] || 'منبع'}</span>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[#254B36] underline underline-offset-2 break-words">
                {r.title || r.url}
              </a>
            ) : (
              <span className="text-[#292524]">{r.title}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
