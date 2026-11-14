import React, { useState } from 'react';
import { Check, Copy, Mail, MessageCircle, Send, Share2, X } from 'lucide-react';
import type { Language } from '../types';

interface ShareMenuProps {
  lang: Language;
  title: string;
  text: string;
  url: string;
  onClose: () => void;
}

/** Choose the app to share a place link with. Uses plain share URLs: no keys, no SDKs. */
export function ShareMenu({ lang, title, text, url, onClose }: ShareMenuProps) {
  const fa = lang === 'fa';
  const [copied, setCopied] = useState(false);
  const message = `${title}\n${url}`;
  const enc = encodeURIComponent;

  const targets = [
    { id: 'telegram', label: fa ? 'تلگرام' : 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`, color: '#229ED9', icon: <Send className="w-4 h-4" /> },
    { id: 'whatsapp', label: fa ? 'واتس‌اپ' : 'WhatsApp', href: `https://wa.me/?text=${enc(message)}`, color: '#25D366', icon: <MessageCircle className="w-4 h-4" /> },
    { id: 'bale', label: fa ? 'بله' : 'Bale', href: `https://ble.ir/share?text=${enc(message)}`, color: '#1FAE9B', icon: <MessageCircle className="w-4 h-4" /> },
    { id: 'eitaa', label: fa ? 'ایتا' : 'Eitaa', href: `https://eitaa.com/share/url?url=${enc(url)}&text=${enc(title)}`, color: '#E96B1C', icon: <Send className="w-4 h-4" /> },
    { id: 'sms', label: fa ? 'پیامک' : 'SMS', href: `sms:?&body=${enc(message)}`, color: '#57534E', icon: <MessageCircle className="w-4 h-4" /> },
    { id: 'email', label: fa ? 'ایمیل' : 'Email', href: `mailto:?subject=${enc(title)}&body=${enc(`${text}\n\n${url}`)}`, color: '#806B50', icon: <Mail className="w-4 h-4" /> },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard blocked (some iframes): the visible link below can still be copied by hand
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text, url });
      onClose();
    } catch {
      // cancelled
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[#F5F2E9] rounded-xl border border-[#806B50]/30 shadow-2xl p-4 space-y-3"
        dir={fa ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={fa ? 'اشتراک‌گذاری' : 'Share'}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1C1917] truncate">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[#EBE6DF]" aria-label={fa ? 'بستن' : 'Close'}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {targets.map((t) => (
            <a
              key={t.id}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 py-2.5 rounded-lg bg-white border border-[#806B50]/20 text-[11px] font-medium text-[#1C1917] hover:border-[#254B36]"
            >
              <span className="w-8 h-8 rounded-full text-white flex items-center justify-center" style={{ backgroundColor: t.color }}>
                {t.icon}
              </span>
              {t.label}
            </a>
          ))}
        </div>

        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            type="button"
            onClick={nativeShare}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#EBE6DF] text-xs font-semibold text-[#1C1917]"
          >
            <Share2 className="w-4 h-4" />
            {fa ? 'اپ‌های دیگر…' : 'More apps…'}
          </button>
        )}

        <div className="flex items-center gap-2">
          <input
            readOnly
            dir="ltr"
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white border border-[#806B50]/25 text-[11px] font-mono-num"
          />
          <button type="button" onClick={copy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-semibold">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? (fa ? 'کپی شد' : 'Copied') : fa ? 'کپی' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
