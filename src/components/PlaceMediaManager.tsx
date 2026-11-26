import React, { useEffect, useMemo, useState } from 'react';
import { AudioLines, Download, Film, Image as ImageIcon, Plus, Save, Search, Trash2, X } from 'lucide-react';
import type { AudioItem, Language, PhotoItem, PlaceRecord, VideoItem } from '../types';
import { fetchHostedJson, MediaManifest, PlaceMedia } from '../utils/hostedMedia';
import { WordPressPicker } from './WordPressPicker';
import { BulkPhotoMatch } from './BulkPhotoMatch';
import { SAVE_HEADERS, useHostAuth } from '../utils/hostAuth';

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
const guessKind = (url: string): 'photo' | 'audio' | 'other' =>
  /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url) ? 'photo' : /\.(mp3|m4a|ogg|wav|aac)(\?|$)/i.test(url) ? 'audio' : 'other';

const store = {
  get: (k: string, fb = '') => {
    try {
      return window.localStorage.getItem(k) ?? fb;
    } catch {
      return fb;
    }
  },
  set: (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

export function PlaceMediaManager({ lang, places }: { lang: Language; places: PlaceRecord[] }) {
  const [media, setMedia] = useState<MediaManifest>({});
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | 'image' | 'audio'>(null);
  const [wpBase, setWpBase] = useState(() => store.get('barzok:wpBase', window.location.origin));
  const host = useHostAuth();
  const wp = host?.mode === 'wordpress';
  const [password, setPassword] = useState(() => store.get('barzok:mediaPw'));
  const [manualUrl, setManualUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchHostedJson<MediaManifest>('media.json').then((m) => {
      setMedia(m ?? {});
      setLoaded(true);
    });
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? places.filter((p) => p.nameFa.toLowerCase().includes(q) || (p.nameEn ?? '').toLowerCase().includes(q) || p.id.includes(q))
      : places;
    return list.slice(0, 40);
  }, [places, query]);

  const place = places.find((p) => p.id === placeId) ?? null;
  const current: PlaceMedia = (placeId && media[placeId]) || {};

  const update = (patch: Partial<PlaceMedia>) => {
    if (!placeId) return;
    setMedia((m) => {
      const next = { ...(m[placeId] ?? {}), ...patch };
      const copy = { ...m, [placeId]: next };
      if (!next.photos?.length && !next.audio?.length && !next.videos?.length) delete copy[placeId];
      return copy;
    });
    setDirty(true);
  };

  const addFromWp = (items: { source_url: string; title?: { rendered?: string } }[], kind: 'image' | 'audio') => {
    const rows = items.map((it) => ({ url: it.source_url, text: stripHtml(it.title?.rendered || '') }));
    if (kind === 'image') {
      update({
        photos: [...(current.photos ?? []), ...rows.map<PhotoItem>((r) => ({ url: r.url, captionFa: place?.nameFa ?? '' }))],
      });
    } else {
      update({ audio: [...(current.audio ?? []), ...rows.map<AudioItem>((r) => ({ url: r.url, titleFa: r.text || place?.nameFa || '' }))] });
    }
    setPicker(null);
  };

  const addManual = () => {
    const url = manualUrl.trim();
    if (!url) return;
    const kind = guessKind(url);
    if (kind === 'photo') update({ photos: [...(current.photos ?? []), { url, captionFa: place?.nameFa ?? '' }] });
    else if (kind === 'audio') update({ audio: [...(current.audio ?? []), { url, titleFa: place?.nameFa ?? '' }] });
    else {
      setStatus({ ok: false, text: 'نوع فایل از روی آدرس مشخص نشد (باید jpg، png، mp3 و مانند این‌ها باشد).' });
      return;
    }
    setManualUrl('');
    setStatus(null);
  };

  const addVideo = () => {
    const url = videoUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setStatus({ ok: false, text: 'آدرس فیلم باید با https:// شروع شود.' });
      return;
    }
    update({ videos: [...(current.videos ?? []), { url, titleFa: videoTitle.trim() || place?.nameFa || 'ویدیو' }] });
    setVideoUrl('');
    setVideoTitle('');
    setStatus(null);
  };

  const move = <T,>(arr: T[], i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const c = [...arr];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  };

  const save = async () => {
    setStatus(null);
    try {
      const res = await fetch('save-data.php', {
        method: 'POST',
        headers: SAVE_HEADERS,
        credentials: 'same-origin',
        body: JSON.stringify({ password: wp ? undefined : password, target: 'media', media }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      store.set('barzok:mediaPw', password);
      setDirty(false);
      setStatus({ ok: true, text: 'ذخیره شد. همه‌ی بازدیدکنندگان با بارگذاری دوباره‌ی صفحه می‌بینند.' });
    } catch (e) {
      setStatus({
        ok: false,
        text: `ذخیره نشد: ${(e as Error).message}. اگر روی کامپیوتر خودتان (localhost) هستید طبیعی است؛ فقط روی هاست کار می‌کند. می‌توانید فایل را دانلود و دستی آپلود کنید.`,
      });
    }
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(media, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'media.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const count = Object.keys(media).length;
  const inp = 'px-3 py-2 rounded-lg border border-[#806B50]/30 bg-white text-xs';

  return (
    <div className="space-y-5" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="p-4 rounded-xl bg-[#EBE6DF]/70 border border-[#806B50]/20 text-xs leading-relaxed space-y-3">
        <p className="font-semibold text-sm">رسانه‌ی مکان‌ها از وردپرس</p>
        <p>
          عکس و صدا را اول در وردپرس آپلود کنید (رسانه ← افزودن)، بعد اینجا مکان را انتخاب کنید و از کتابخانه برگزینید. برای فیلم، لینک آپارات یا
          یوتیوب بگذارید. در آخر «ذخیره روی هاست» را بزنید.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="block text-[11px] text-[#806B50]">آدرس سایت وردپرس</span>
            <input
              dir="ltr"
              value={wpBase}
              onChange={(e) => {
                setWpBase(e.target.value);
                store.set('barzok:wpBase', e.target.value);
              }}
              className={`${inp} w-full`}
            />
          </label>
          {!wp && <label className="space-y-1">
            <span className="block text-[11px] text-[#806B50]">رمز ذخیره (همان که در save-data.php گذاشتید)</span>
            <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inp} w-full`} />
          </label>}
        </div>
      </div>

      <BulkPhotoMatch
        wpBase={wpBase}
        places={places}
        onApply={(add) => {
          setMedia((m) => {
            const copy = { ...m };
            for (const [id, photos] of Object.entries(add)) {
              const have = new Set((copy[id]?.photos ?? []).map((x) => x.url));
              const fresh = photos.filter((x) => !have.has(x.url));
              if (fresh.length) copy[id] = { ...(copy[id] ?? {}), photos: [...(copy[id]?.photos ?? []), ...fresh] };
            }
            return copy;
          });
          setDirty(true);
          setStatus({ ok: true, text: 'عکس‌ها به مکان‌ها اضافه شد. حالا «ذخیره روی هاست» را بزنید.' });
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی مکان..." className={`${inp} w-full`} />
          <ul className="max-h-[28rem] overflow-y-auto space-y-1 pe-1">
            {matches.map((p) => {
              const m = media[p.id];
              const n = (m?.photos?.length ?? 0) + (m?.audio?.length ?? 0) + (m?.videos?.length ?? 0);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPlaceId(p.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs text-start ${
                      p.id === placeId ? 'bg-[#254B36] text-[#F5F2E9]' : 'bg-white hover:bg-[#EBE6DF]'
                    }`}
                  >
                    <span className="truncate">{p.nameFa}</span>
                    {n > 0 && <span className="shrink-0 px-1.5 rounded bg-[#D6A83F] text-[#1C1917] font-bold">{n}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="lg:col-span-8 space-y-5">
          {!place ? (
            <p className="text-xs text-[#806B50] p-6 text-center">یک مکان از فهرست انتخاب کنید.</p>
          ) : (
            <>
              <div>
                <h3 className="text-base font-bold">{place.nameFa}</h3>
                <span className="text-[11px] text-[#806B50] font-mono-num" dir="ltr">
                  {place.id}
                </span>
              </div>

              {/* Photos */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" /> عکس‌ها (اولی، عکس اصلی است)
                  </h4>
                  <button type="button" onClick={() => setPicker('image')} className="px-3 py-1.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-semibold flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> انتخاب از وردپرس
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {(current.photos ?? []).map((ph, i, arr) => (
                    <div key={ph.url} className="space-y-1">
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-[#EBE6DF]">
                        <img src={ph.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => update({ photos: arr.filter((_, k) => k !== i) })} className="absolute top-1 left-1 p-1 rounded bg-white/90 text-red-700">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute bottom-1 right-1 flex gap-1">
                          <button type="button" disabled={i === 0} onClick={() => update({ photos: move(arr, i, -1) })} className="px-1.5 rounded bg-white/90 text-xs disabled:opacity-40">→</button>
                          <button type="button" disabled={i === arr.length - 1} onClick={() => update({ photos: move(arr, i, 1) })} className="px-1.5 rounded bg-white/90 text-xs disabled:opacity-40">←</button>
                        </div>
                      </div>
                      <input
                        value={ph.captionFa ?? ''}
                        onChange={(e) => update({ photos: arr.map((x, k) => (k === i ? { ...x, captionFa: e.target.value } : x)) })}
                        placeholder="توضیح عکس"
                        className={`${inp} w-full py-1`}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Audio */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <AudioLines className="w-4 h-4" /> روایت صوتی
                  </h4>
                  <button type="button" onClick={() => setPicker('audio')} className="px-3 py-1.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-semibold flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> انتخاب از وردپرس
                  </button>
                </div>
                {(current.audio ?? []).map((a, i, arr) => (
                  <div key={a.url} className="p-2 rounded-lg bg-white border border-[#806B50]/20 space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        value={a.titleFa}
                        onChange={(e) => update({ audio: arr.map((x, k) => (k === i ? { ...x, titleFa: e.target.value } : x)) })}
                        className={`${inp} flex-1 py-1`}
                      />
                      <button type="button" onClick={() => update({ audio: arr.filter((_, k) => k !== i) })} className="p-1.5 rounded text-red-700 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <audio controls preload="none" src={a.url} className="w-full h-8" />
                  </div>
                ))}
              </section>

              {/* Video */}
              <section className="space-y-2">
                <h4 className="text-xs font-bold flex items-center gap-1.5">
                  <Film className="w-4 h-4" /> فیلم (لینک آپارات یا یوتیوب)
                </h4>
                {(current.videos ?? []).map((v, i, arr) => (
                  <div key={v.url} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-[#806B50]/20 text-xs">
                    <span className="flex-1 truncate">{v.titleFa}</span>
                    <span className="flex-1 truncate text-[#806B50]" dir="ltr">{v.url}</span>
                    <button type="button" onClick={() => update({ videos: arr.filter((_, k) => k !== i) })} className="p-1.5 rounded text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <input dir="ltr" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.aparat.com/v/..." className={`${inp} flex-1 min-w-[12rem]`} />
                  <input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="عنوان" className={`${inp} w-40`} />
                  <button type="button" onClick={addVideo} className="px-3 py-2 rounded-lg bg-[#EBE6DF] text-xs font-semibold">افزودن فیلم</button>
                </div>
              </section>

              <section className="space-y-1">
                <span className="text-[11px] text-[#806B50]">یا آدرس مستقیم یک عکس/صدا (اگر کتابخانه باز نشد):</span>
                <div className="flex gap-2">
                  <input dir="ltr" value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} placeholder="https://barzokhouse.com/wp-content/uploads/..." className={`${inp} flex-1`} />
                  <button type="button" onClick={addManual} className="px-3 py-2 rounded-lg bg-[#EBE6DF] text-xs font-semibold">افزودن</button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#F5F2E9] border border-[#806B50]/30 shadow-lg">
        <button type="button" onClick={save} disabled={!loaded || !dirty || (!wp && !password)} className="px-4 py-2 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40">
          <Save className="w-4 h-4" /> ذخیره روی هاست
        </button>
        <button type="button" onClick={download} className="px-3 py-2 rounded-lg bg-[#EBE6DF] text-xs font-semibold flex items-center gap-1.5">
          <Download className="w-4 h-4" /> دانلود media.json
        </button>
        <span className="text-xs text-[#57534E]">
          {count} مکان دارای رسانه{dirty ? ' · تغییرات ذخیره نشده' : ''}
        </span>
        {status && <span className={`text-xs font-medium ${status.ok ? 'text-[#254B36]' : 'text-red-700'}`}>{status.text}</span>}
      </div>

      {picker && <WordPressPicker kind={picker} wpBase={wpBase} onPick={(items) => addFromWp(items, picker)} onClose={() => setPicker(null)} />}
    </div>
  );
}
