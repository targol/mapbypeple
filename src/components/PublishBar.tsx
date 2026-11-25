import React, { useEffect, useState } from 'react';
import { SAVE_HEADERS, useHostAuth } from '../utils/hostAuth';
import { discardLocalEdits, getPublishSnapshot, isDirty, markPublished } from '../data/localBackend';

const get = (k: string) => {
  try {
    return window.localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};

/** Admin edits live in this browser until published; this writes them to data.json on the host. */
export function PublishBar() {
  const host = useHostAuth();
  const wp = host?.mode === 'wordpress';
  const [dirty, setDirtyState] = useState(isDirty());
  const [pw, setPw] = useState(() => get('barzok:mediaPw'));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const on = () => setDirtyState(isDirty());
    window.addEventListener('barzok-dirty-changed', on);
    return () => window.removeEventListener('barzok-dirty-changed', on);
  }, []);

  const publish = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('./save-data.php', {
        method: 'POST',
        headers: SAVE_HEADERS,
        credentials: 'same-origin',
        body: JSON.stringify({ password: wp ? undefined : pw, target: 'data', data: getPublishSnapshot() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.ok === false) throw new Error(j.error || `HTTP ${res.status}`);
      try {
        window.localStorage.setItem('barzok:mediaPw', pw);
      } catch {
        /* ignore */
      }
      markPublished();
      setMsg({ ok: true, text: 'منتشر شد؛ اکنون همه‌ی بازدیدکنندگان نسخه‌ی جدید را می‌بینند.' });
    } catch (e) {
      setMsg({ ok: false, text: `منتشر نشد: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`sticky top-0 z-30 rounded-lg border p-3 flex flex-wrap items-center gap-2 text-xs ${
        dirty ? 'bg-[#D6A83F]/25 border-[#D6A83F]' : 'bg-white/70 border-[#806B50]/20'
      }`}
      data-testid="publish-bar"
    >
      <span className="font-semibold">{dirty ? 'تغییرات ذخیره‌نشده روی هاست (فقط در این مرورگر)' : 'همه‌ی تغییرات منتشر شده است'}</span>
      {wp ? (
        <span className="text-[#57534E]">وارد شده با حساب وردپرس{host?.name ? `: ${host.name}` : ''}</span>
      ) : (
        <input
          type="password"
          dir="ltr"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="رمز save-data.php"
          className="px-2 py-1.5 rounded border border-[#806B50]/30 bg-white w-40"
        />
      )}
      <button type="button" disabled={!dirty || (!wp && !pw) || busy} onClick={publish} className="px-3 py-1.5 rounded-lg bg-[#254B36] text-[#F5F2E9] font-semibold disabled:opacity-40">
        {busy ? 'در حال انتشار…' : 'انتشار روی هاست'}
      </button>
      {dirty && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm('تغییرات منتشرنشده دور ریخته شود؟')) {
              discardLocalEdits();
              window.location.reload();
            }
          }}
          className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-700"
        >
          دور ریختن تغییرات
        </button>
      )}
      {msg && <span className={msg.ok ? 'text-[#254B36] font-medium' : 'text-red-700 font-medium'}>{msg.text}</span>}
    </div>
  );
}
