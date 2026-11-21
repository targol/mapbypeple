import React, { useEffect, useState } from 'react';
import { Search, Upload, X } from 'lucide-react';

export interface WpMediaItem {
  id: number;
  source_url: string;
  mime_type: string;
  title?: { rendered?: string };
  media_details?: { sizes?: Record<string, { source_url: string }> };
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();

const session = {
  get: (k: string) => {
    try {
      return window.sessionStorage.getItem(k) ?? '';
    } catch {
      return '';
    }
  },
  set: (k: string, v: string) => {
    try {
      window.sessionStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

/**
 * The WordPress media library, inside the map admin: pick files that are already there, or upload
 * a new one (it goes into the same library). Upload needs a WordPress "Application Password";
 * everything is plain WordPress REST, so no plugin is required.
 */
export function WordPressPicker({
  kind,
  wpBase,
  multiple = true,
  onPick,
  onClose,
}: {
  kind: 'image' | 'audio';
  wpBase: string;
  multiple?: boolean;
  onPick: (items: WpMediaItem[]) => void;
  onClose: () => void;
}) {
  const base = wpBase.replace(/\/$/, '');
  const [items, setItems] = useState<WpMediaItem[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState<WpMediaItem[]>([]);
  const [manual, setManual] = useState('');
  const [user, setUser] = useState(() => session.get('barzok:wpUser'));
  const [appPw, setAppPw] = useState(() => session.get('barzok:wpAppPw'));
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async (p: number, q: string, replace: boolean) => {
    setLoading(true);
    setError('');
    try {
      const url = `${base}/wp-json/wp/v2/media?media_type=${kind}&per_page=30&page=${p}&orderby=date&order=desc&search=${encodeURIComponent(
        q
      )}&_fields=id,source_url,mime_type,title,media_details`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as WpMediaItem[];
      setItems((prev) => (replace ? data : [...prev, ...data]));
      setMore(data.length === 30);
    } catch (e) {
      setError(`کتابخانه‌ی وردپرس خوانده نشد (${(e as Error).message}). آدرس سایت را بررسی کنید یا آدرس فایل را پایین دستی بنویسید.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, '', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (it: WpMediaItem) =>
    setChosen((c) => (c.some((x) => x.id === it.id) ? c.filter((x) => x.id !== it.id) : multiple ? [...c, it] : [it]));

  const upload = async (file: File) => {
    setUploadMsg(null);
    if (!user || !appPw) {
      setUploadMsg({ ok: false, text: 'نام کاربری و «رمز برنامه» وردپرس را بنویسید.' });
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || `file-${Date.now()}`;
      const res = await fetch(`${base}/wp-json/wp/v2/media`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${user}:${appPw.replace(/\s+/g, ' ')}`)}`,
          'Content-Disposition': `attachment; filename="${safeName}"`,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });
      if (res.status === 401 || res.status === 403) throw new Error('نام کاربری یا رمز برنامه درست نیست (یا این کاربر اجازه‌ی آپلود ندارد)');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const it = (await res.json()) as WpMediaItem;
      session.set('barzok:wpUser', user);
      session.set('barzok:wpAppPw', appPw);
      setItems((prev) => [it, ...prev]);
      setChosen((c) => (multiple ? [...c, it] : [it]));
      setUploadMsg({ ok: true, text: 'آپلود شد و انتخاب شد.' });
    } catch (e) {
      setUploadMsg({ ok: false, text: `آپلود نشد: ${(e as Error).message}` });
    } finally {
      setUploading(false);
    }
  };

  const addManual = () => {
    const url = manual.trim();
    if (!/^https?:\/\//i.test(url) && !/^[\w\-./%]+$/.test(url)) return;
    setChosen((c) => [...c, { id: -Date.now(), source_url: url, mime_type: '', title: { rendered: '' } }]);
    setManual('');
  };

  const inp = 'px-3 py-2 rounded-lg border border-[#806B50]/30 bg-white text-xs';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#F5F2E9] rounded-xl shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-3 border-b border-[#806B50]/20">
          <h3 className="text-sm font-bold">{kind === 'image' ? 'آلبوم عکس وردپرس' : 'فایل‌های صوتی وردپرس'}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[#EBE6DF]" aria-label="بستن">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* upload into the WordPress library */}
          <details className="m-3 rounded-lg bg-[#EBE6DF]/60 border border-[#806B50]/20 text-xs" open={items.length === 0 && !loading}>
            <summary className="px-3 py-2 font-semibold cursor-pointer flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> آپلود فایل جدید از کامپیوتر یا موبایل
            </summary>
            <div className="p-3 pt-1 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input dir="ltr" value={user} onChange={(e) => setUser(e.target.value)} placeholder="نام کاربری وردپرس" className={inp} />
                <input dir="ltr" type="password" value={appPw} onChange={(e) => setAppPw(e.target.value)} placeholder="Application Password" className={inp} />
              </div>
              <p className="text-[11px] text-[#806B50] leading-relaxed">
                رمز برنامه را در وردپرس بسازید: کاربران ← پروفایل شما ← «Application Passwords». این رمز، همان رمز ورود نیست و فقط تا بستن مرورگر
                نگه داشته می‌شود.
              </p>
              <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-semibold cursor-pointer ${uploading ? 'opacity-50' : ''}`}>
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'در حال آپلود…' : kind === 'image' ? 'انتخاب عکس و آپلود' : 'انتخاب فایل صوتی و آپلود'}
                <input
                  type="file"
                  accept={kind === 'image' ? 'image/*' : 'audio/*'}
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) upload(f);
                  }}
                />
              </label>
              {uploadMsg && <div className={`text-xs font-medium ${uploadMsg.ok ? 'text-[#254B36]' : 'text-red-700'}`}>{uploadMsg.text}</div>}
            </div>
          </details>

          <form
            className="flex gap-2 px-3 pb-3"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              load(1, query, true);
            }}
          >
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجو در نام فایل..." className={`${inp} flex-1`} />
            <button className="px-3 py-2 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-semibold flex items-center gap-1">
              <Search className="w-3.5 h-3.5" /> جستجو
            </button>
          </form>

          {error && <div className="mx-3 mb-2 p-3 rounded-lg bg-[#D6A83F]/25 text-xs">{error}</div>}

          <div className="px-3 pb-3">
            {kind === 'image' ? (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {items.map((it) => {
                  const sel = chosen.some((x) => x.id === it.id);
                  const thumb = it.media_details?.sizes?.medium?.source_url || it.media_details?.sizes?.thumbnail?.source_url || it.source_url;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => toggle(it)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 ${sel ? 'border-[#254B36]' : 'border-transparent'}`}
                      title={stripHtml(it.title?.rendered || '')}
                    >
                      <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                      {sel && (
                        <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#254B36] text-white text-[11px] flex items-center justify-center">
                          {chosen.findIndex((x) => x.id === it.id) + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {items.map((it) => {
                  const sel = chosen.some((x) => x.id === it.id);
                  return (
                    <li key={it.id} className={`p-2 rounded-lg border ${sel ? 'border-[#254B36] bg-white' : 'border-[#806B50]/20 bg-white/60'}`}>
                      <button type="button" onClick={() => toggle(it)} className="w-full text-start text-xs font-medium mb-1">
                        {sel ? '✓ ' : ''}
                        {stripHtml(it.title?.rendered || it.source_url)}
                      </button>
                      <audio controls preload="none" src={it.source_url} className="w-full h-8" />
                    </li>
                  );
                })}
              </ul>
            )}
            {loading && <div className="text-xs text-[#806B50] p-3">در حال بارگذاری…</div>}
            {!loading && !error && items.length === 0 && <div className="text-xs text-[#806B50] p-3">فایلی پیدا نشد. با بخش آپلود بالا اضافه کنید.</div>}
            {more && !loading && (
              <button
                type="button"
                onClick={() => {
                  setPage(page + 1);
                  load(page + 1, query, false);
                }}
                className="mt-3 w-full py-2 rounded-lg bg-[#EBE6DF] text-xs font-semibold"
              >
                نمایش بیشتر
              </button>
            )}
          </div>

          <div className="px-3 pb-3 space-y-1">
            <span className="text-[11px] text-[#806B50]">اگر کتابخانه باز نشد، آدرس مستقیم فایل را اینجا بنویسید:</span>
            <div className="flex gap-2">
              <input dir="ltr" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="https://barzokhouse.com/wp-content/uploads/..." className={`${inp} flex-1`} />
              <button type="button" onClick={addManual} className="px-3 py-2 rounded-lg bg-[#EBE6DF] text-xs font-semibold">
                افزودن
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-[#806B50]/20 flex items-center justify-between">
          <span className="text-xs text-[#57534E]">{chosen.length} فایل انتخاب شده</span>
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => onPick(chosen)}
            className="px-4 py-2 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-semibold disabled:opacity-40"
          >
            تأیید و افزودن
          </button>
        </div>
      </div>
    </div>
  );
}
