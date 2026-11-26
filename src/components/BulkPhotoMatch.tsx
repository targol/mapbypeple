import React, { useState } from 'react';
import type { PhotoItem, PlaceRecord } from '../types';
import type { MediaManifest } from '../utils/hostedMedia';

interface WpImg {
  source_url: string;
  title?: { rendered?: string };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‏‎_\-.()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function fileBase(url: string): string {
  let f = url.split('?')[0].split('/').pop() || '';
  try {
    f = decodeURIComponent(f);
  } catch {
    /* keep */
  }
  return f.replace(/\.[a-z0-9]+$/i, '').replace(/-scaled$/i, '').replace(/-\d+x\d+$/i, '');
}

/** Candidates, longest first: "x-001-2" → "x-001-2", "x-001" ; "name 3" → "name 3", "name" */
function candidates(base: string): { key: string; order: number }[] {
  const out = [{ key: norm(base), order: 0 }];
  const m = base.match(/^(.*?)[\s_\-(]+(\d{1,3})\)?$/);
  if (m) out.push({ key: norm(m[1]), order: Number(m[2]) });
  return out;
}

export async function fetchAllWpImages(wpBase: string): Promise<WpImg[]> {
  const base = wpBase.replace(/\/$/, '');
  const all: WpImg[] = [];
  for (let page = 1; page <= 30; page++) {
    const res = await fetch(`${base}/wp-json/wp/v2/media?media_type=image&per_page=100&page=${page}&orderby=date&order=asc&_fields=id,source_url,title`);
    if (res.status === 400) break; // past the last page
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as WpImg[];
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all;
}

export function matchImages(images: WpImg[], places: PlaceRecord[]) {
  const index = new Map<string, PlaceRecord>();
  for (const p of places) {
    index.set(norm(p.id), p);
    index.set(norm(p.nameFa), p);
    if (p.nameEn) index.set(norm(p.nameEn), p);
  }
  const byPlace = new Map<string, { order: number; url: string }[]>();
  const unmatched: string[] = [];
  for (const img of images) {
    const base = fileBase(img.source_url);
    let hit: { p: PlaceRecord; order: number } | null = null;
    for (const c of candidates(base)) {
      const p = index.get(c.key);
      if (p) {
        hit = { p, order: c.order };
        break;
      }
    }
    if (!hit) {
      unmatched.push(base);
      continue;
    }
    const list = byPlace.get(hit.p.id) ?? [];
    list.push({ order: hit.order, url: img.source_url });
    byPlace.set(hit.p.id, list);
  }
  return { byPlace, unmatched };
}

/** Many photos at once: upload them all to the WordPress library, name them after the place, and attach in one click. */
export function BulkPhotoMatch({
  wpBase,
  places,
  onApply,
}: {
  wpBase: string;
  places: PlaceRecord[];
  onApply: (add: Record<string, PhotoItem[]>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<{ total: number; byPlace: Map<string, { order: number; url: string }[]>; unmatched: string[] } | null>(null);

  const run = async () => {
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const imgs = await fetchAllWpImages(wpBase);
      const { byPlace, unmatched } = matchImages(imgs, places);
      setResult({ total: imgs.length, byPlace, unmatched });
    } catch (e) {
      setErr(`کتابخانه‌ی وردپرس خوانده نشد (${(e as Error).message}).`);
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!result) return;
    const add: Record<string, PhotoItem[]> = {};
    result.byPlace.forEach((list, id) => {
      const nameFa = places.find((p) => p.id === id)?.nameFa ?? '';
      add[id] = list.sort((a, b) => a.order - b.order).map((x) => ({ url: x.url, captionFa: nameFa }));
    });
    onApply(add);
    setResult(null);
  };

  return (
    <div className="p-4 rounded-xl bg-white border border-[#806B50]/25 text-xs leading-relaxed space-y-3" data-testid="bulk-photos">
      <p className="font-semibold text-sm">اتصال گروهی عکس‌ها</p>
      <ol className="list-decimal pe-5 ps-5 space-y-1 text-[#57534E]">
        <li>
          همه‌ی عکس‌ها را یک‌جا در وردپرس آپلود کنید (رسانه ← افزودن، چند فایل را بکشید و رها کنید). نام هر فایل باید «شناسه‌ی مکان» یا «نام مکان» باشد،
          با شماره‌ی اختیاری در آخر. مثال: <span dir="ltr" className="font-mono-num">water-001-1.jpg</span>، <span dir="ltr" className="font-mono-num">water-001-2.jpg</span> یا «حمام
          برزک 2.jpg».
        </li>
        <li>دکمه‌ی زیر را بزنید تا نقشه نام فایل‌ها را بخواند و به مکان‌ها وصل کند.</li>
        <li>نتیجه را ببینید، «افزودن» را بزنید و بعد پایین صفحه «ذخیره روی هاست» را بزنید.</li>
      </ol>
      <button type="button" disabled={busy} onClick={run} className="px-4 py-2 rounded-lg bg-[#254B36] text-[#F5F2E9] font-semibold disabled:opacity-50">
        {busy ? 'در حال خواندن…' : 'خواندن آلبوم و تطبیق خودکار'}
      </button>
      {err && <div className="text-red-700">{err}</div>}
      {result && (
        <div className="space-y-2">
          <div>
            <b>{result.total}</b> عکس در آلبوم هست؛ <b>{Array.from(result.byPlace.values()).reduce((n, l) => n + l.length, 0)}</b> عکس به{' '}
            <b>{result.byPlace.size}</b> مکان وصل شد؛ <b>{result.unmatched.length}</b> عکس با هیچ مکانی نخواند.
          </div>
          {result.unmatched.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[#806B50]">فهرست عکس‌های بدون مکان</summary>
              <div dir="ltr" className="mt-1 max-h-40 overflow-y-auto text-[11px] text-[#57534E] break-all">
                {result.unmatched.slice(0, 200).join(' · ')}
              </div>
            </details>
          )}
          {result.byPlace.size > 0 && (
            <button type="button" onClick={apply} className="px-4 py-2 rounded-lg bg-[#D6A83F] text-[#1C1917] font-semibold">
              افزودن عکس‌ها به مکان‌ها
            </button>
          )}
        </div>
      )}
    </div>
  );
}
