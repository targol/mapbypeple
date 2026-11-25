import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { AudioItem, PhotoItem, ReferenceItem, VideoItem } from '../types';
import { WordPressPicker } from './WordPressPicker';

const stripTags = (t: string) => t.replace(/<[^>]*>/g, '').trim();
const btn = 'px-3 py-1.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium hover:bg-[#1d3b2a]';
const iconBtn = 'p-1.5 rounded bg-white border border-[#806B50]/30 disabled:opacity-30';
const inp = 'w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#806B50]/30 text-xs';

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const c = arr.slice();
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

function RowTools<T>({ items, i, onChange }: { items: T[]; i: number; onChange: (x: T[]) => void }) {
  return (
    <div className="flex flex-col gap-1 shrink-0">
      <div className="flex gap-1">
        <button type="button" className={iconBtn} disabled={i === 0} onClick={() => onChange(move(items, i, -1))} aria-label="بالا">
          <ArrowUp className="w-3 h-3" />
        </button>
        <button type="button" className={iconBtn} disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} aria-label="پایین">
          <ArrowDown className="w-3 h-3" />
        </button>
      </div>
      <button type="button" className={`${iconBtn} text-red-700 border-red-300`} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="حذف">
        <Trash2 className="w-3 h-3 mx-auto" />
      </button>
    </div>
  );
}

/** Any number of photos or audio files, chosen from / uploaded to the WordPress library. */
export function WpMediaListEditor({
  kind,
  wpBase,
  photos,
  audios,
  onPhotos,
  onAudios,
}: {
  kind: 'image' | 'audio';
  wpBase: string;
  photos?: PhotoItem[];
  audios?: AudioItem[];
  onPhotos?: (p: PhotoItem[]) => void;
  onAudios?: (a: AudioItem[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const isImg = kind === 'image';
  return (
    <div className="p-3.5 rounded-lg bg-[#EBE6DF]/50 border border-[#806B50]/20 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-[#1C1917]">
          {isImg ? `عکس‌ها (${photos?.length ?? 0}) — از آلبوم وردپرس` : `فایل‌های صوتی (${audios?.length ?? 0}) — از وردپرس`}
        </label>
        <button type="button" className={btn} onClick={() => setOpen(true)}>
          <Plus className="w-3.5 h-3.5 inline -mt-0.5" /> {isImg ? 'افزودن عکس' : 'افزودن صدا'}
        </button>
      </div>
      {isImg
        ? (photos ?? []).map((p, i) => (
            <div key={`${p.url}-${i}`} className="flex gap-2 items-center">
              <img src={p.url} alt="" className="w-14 h-14 rounded-lg object-cover border border-[#806B50]/30 shrink-0" />
              <input
                className={inp}
                value={p.captionFa || ''}
                placeholder="زیرنویس عکس (اختیاری)"
                onChange={(e) => onPhotos?.((photos ?? []).map((x, j) => (j === i ? { ...x, captionFa: e.target.value } : x)))}
              />
              <RowTools items={photos ?? []} i={i} onChange={(x) => onPhotos?.(x)} />
            </div>
          ))
        : (audios ?? []).map((a, i) => (
            <div key={`${a.url}-${i}`} className="space-y-1">
              <div className="flex gap-2 items-center">
                <input
                  className={inp}
                  value={a.titleFa || ''}
                  placeholder="عنوان فایل صوتی"
                  onChange={(e) => onAudios?.((audios ?? []).map((x, j) => (j === i ? { ...x, titleFa: e.target.value } : x)))}
                />
                <RowTools items={audios ?? []} i={i} onChange={(x) => onAudios?.(x)} />
              </div>
              <audio controls preload="none" src={a.url} className="w-full h-8" />
            </div>
          ))}
      {open && (
        <WordPressPicker
          kind={kind}
          wpBase={wpBase}
          multiple
          onClose={() => setOpen(false)}
          onPick={(items) => {
            if (isImg) {
              const have = new Set((photos ?? []).map((p) => p.url));
              const add = items.filter((it) => !have.has(it.source_url)).map((it) => ({ url: it.source_url, captionFa: stripTags(it.title?.rendered || '') }));
              onPhotos?.([...(photos ?? []), ...add]);
            } else {
              const have = new Set((audios ?? []).map((p) => p.url));
              const add = items
                .filter((it) => !have.has(it.source_url))
                .map((it) => ({ url: it.source_url, titleFa: stripTags(it.title?.rendered || '') || 'روایت صوتی' }));
              onAudios?.([...(audios ?? []), ...add]);
            }
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Any number of Aparat / YouTube links. */
export function VideoListEditor({ videos, onChange }: { videos: VideoItem[]; onChange: (v: VideoItem[]) => void }) {
  const [url, setUrl] = useState('');
  const add = () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return;
    onChange([...videos, { url: u, titleFa: '' }]);
    setUrl('');
  };
  return (
    <div className="p-3.5 rounded-lg bg-[#EBE6DF]/50 border border-[#806B50]/20 space-y-2.5">
      <label className="text-xs font-semibold text-[#1C1917]">ویدیوها ({videos.length}) — پیوند آپارات یا یوتیوب</label>
      {videos.map((v, i) => (
        <div key={`${v.url}-${i}`} className="flex gap-2 items-center">
          <div className="flex-1 space-y-1 min-w-0">
            <input
              className={inp}
              value={v.titleFa || ''}
              placeholder="عنوان ویدیو"
              onChange={(e) => onChange(videos.map((x, j) => (j === i ? { ...x, titleFa: e.target.value } : x)))}
            />
            <div dir="ltr" className="text-[11px] text-[#806B50] truncate">{v.url}</div>
          </div>
          <RowTools items={videos} i={i} onChange={onChange} />
        </div>
      ))}
      <div className="flex gap-2">
        <input
          dir="ltr"
          className={inp}
          value={url}
          placeholder="https://www.aparat.com/v/..."
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className={btn} onClick={add}>
          افزودن
        </button>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<ReferenceItem['kind'], string> = { article: 'مقاله', book: 'کتاب', website: 'وب‌سایت', other: 'سایر' };

/** Articles, books and web pages that back up a place / ritual / story. */
export function ReferencesEditor({ refs, onChange }: { refs: ReferenceItem[]; onChange: (r: ReferenceItem[]) => void }) {
  return (
    <div className="p-3.5 rounded-lg bg-[#EBE6DF]/50 border border-[#806B50]/20 space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#1C1917]">منابع و مقالات ({refs.length})</label>
        <button type="button" className={btn} onClick={() => onChange([...refs, { title: '', url: '', kind: 'article' }])}>
          <Plus className="w-3.5 h-3.5 inline -mt-0.5" /> افزودن منبع
        </button>
      </div>
      {refs.map((r, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-[7rem_1fr] gap-1.5 min-w-0">
            <select className={inp} value={r.kind} onChange={(e) => onChange(refs.map((x, j) => (j === i ? { ...x, kind: e.target.value as ReferenceItem['kind'] } : x)))}>
              {(Object.keys(KIND_LABEL) as ReferenceItem['kind'][]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <input className={inp} value={r.title} placeholder="عنوان (نام مقاله، کتاب و نویسنده...)" onChange={(e) => onChange(refs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <input
              dir="ltr"
              className={`${inp} sm:col-span-2`}
              value={r.url || ''}
              placeholder="لینک (اختیاری) https://..."
              onChange={(e) => onChange(refs.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
            />
          </div>
          <RowTools items={refs} i={i} onChange={onChange} />
        </div>
      ))}
    </div>
  );
}
