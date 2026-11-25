import React, { useEffect, useRef } from 'react';
import type { Language } from '../types';

/** One small tri-state checkbox (like "select all" in a mailbox): all on → click turns all off, otherwise turns all on. */
export function LayerAllToggle({ lang, total, on, onChange }: { lang: Language; total: number; on: number; onChange: (on: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const all = total > 0 && on === total;
  const partial = on > 0 && on < total;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);
  return (
    <label
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#57534E] cursor-pointer select-none"
      title={lang === 'fa' ? 'روشن / خاموش کردن همه‌ی لایه‌ها' : 'Show / hide all layers'}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={all}
        onChange={() => onChange(!all)}
        aria-label={lang === 'fa' ? 'همه‌ی لایه‌ها' : 'All layers'}
        className="accent-[#254B36] w-4 h-4"
      />
      <span>{lang === 'fa' ? 'همه' : 'All'}</span>
      <span className="font-mono-num text-[#806B50]">
        {on}/{total}
      </span>
    </label>
  );
}
