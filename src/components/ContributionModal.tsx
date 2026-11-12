import React, { useState } from 'react';
import { CheckCircle2, MapPin, Send, ShieldCheck, X } from 'lucide-react';
import { BARZOK_CENTER, Language } from '../types';

interface ContributionModalProps {
  lang: Language;
  pickedCoords: { lat: number; lng: number } | null;
  onRequestMapPick: () => void;
  onClose: () => void;
}

const SUBMISSION_TYPES = [
  {
    id: 'historical_location',
    labelFa: 'مکان یا بنای تاریخی',
    labelEn: 'Historical Location',
  },
  {
    id: 'old_photograph',
    labelFa: 'عکس قدیمی یا سند آرشیوی',
    labelEn: 'Old Photograph or Document',
  },
  {
    id: 'personal_memory',
    labelFa: 'خاطره شخصی یا تاریخ شفاهی',
    labelEn: 'Personal Memory / Oral History',
  },
  {
    id: 'local_person',
    labelFa: 'چهره محلی یا پیشه‌ور سنتی',
    labelEn: 'Local Person or Occupation',
  },
  {
    id: 'traditional_custom',
    labelFa: 'آیین یا سنت بومی',
    labelEn: 'Traditional Custom',
  },
  {
    id: 'environmental_cultural',
    labelFa: 'نقطه طبیعی یا فرهنگی',
    labelEn: 'Environmental or Cultural Point of Interest',
  },
];

export function ContributionModal({
  lang,
  pickedCoords,
  onRequestMapPick,
  onClose,
}: ContributionModalProps) {
  const [submissionType, setSubmissionType] = useState('historical_location');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState<string>(
    pickedCoords ? String(pickedCoords.lat) : ''
  );
  const [longitude, setLongitude] = useState<string>(
    pickedCoords ? String(pickedCoords.lng) : ''
  );
  const [mediaUrl, setMediaUrl] = useState('');
  const [contributorName, setContributorName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [consentToPublish, setConsentToPublish] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  React.useEffect(() => {
    if (pickedCoords) {
      setLatitude(String(pickedCoords.lat));
      setLongitude(String(pickedCoords.lng));
    }
  }, [pickedCoords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/public/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionType,
          title,
          description,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
          mediaUrl: mediaUrl || null,
          contributorName,
          contactInfo,
          consentToPublish,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در ثبت مشارکت');
      }

      setSubmittedSuccess(true);
    } catch (err: any) {
      setError(err.message || 'خطایی رخ داد.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#F5F2E9] border border-[#806B50]/30 rounded-xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#254B36] text-[#F5F2E9]">
          <div>
            <h2 className="text-lg font-bold">
              {lang === 'fa'
                ? 'مشارکت مردمی در نقشه زنده برزک'
                : 'Community Contribution to Barzok Map'}
            </h2>
            <p className="text-xs text-[#F5F2E9]/80 mt-0.5">
              {lang === 'fa'
                ? 'پیشنهاد مکان، عکس قدیمی، خاطره یا پیشه محلی (انتشار پس از بررسی و تایید مدیریت)'
                : 'Suggest a location, archival photo, memory, or local craft (published after moderation)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#F5F2E9]/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedSuccess ? (
          <div className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-[#254B36] mx-auto" />
            <h3 className="text-xl font-bold text-[#1C1917]">
              {lang === 'fa'
                ? 'مشارکت شما با موفقیت در صف بررسی ثبت شد'
                : 'Your Contribution Has Been Submitted for Review'}
            </h3>
            <p className="text-sm text-[#57534E] max-w-md mx-auto leading-relaxed">
              {lang === 'fa'
                ? 'از همراهی شما در حفظ حافظه فرهنگی و تاریخی برزک سپاسگزاریم. اطلاعات ارسالی پس از بررسی و مستندسازی توسط هیئت تحریریه در نقشه عمومی منتشر خواهد شد.'
                : 'Thank you for helping preserve the living cultural heritage of Barzok. Your submission is now in the moderation queue and will appear once verified by an administrator.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-sm font-medium hover:bg-[#1d3b2a] transition-colors"
            >
              {lang === 'fa' ? 'بازگشت به نقشه' : 'Return to Map'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                  {lang === 'fa' ? 'نوع مشارکت *' : 'Submission Type *'}
                </label>
                <select
                  value={submissionType}
                  onChange={(e) => setSubmissionType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#806B50]/30 text-sm text-[#1C1917] focus:outline-none focus:border-[#254B36]"
                >
                  {SUBMISSION_TYPES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {lang === 'fa' ? st.labelFa : st.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                  {lang === 'fa' ? 'عنوان موضوع *' : 'Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    lang === 'fa'
                      ? 'مثلاً: آسیاب قدیمی محله بالا یا خاطره گلاب‌گیری...'
                      : 'e.g., Historic watermill or family memory...'
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#806B50]/30 text-sm text-[#1C1917] focus:outline-none focus:border-[#254B36]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                {lang === 'fa'
                  ? 'شرح کامل، روایت یا توضیحات مستند *'
                  : 'Detailed Description or Story *'}
              </label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  lang === 'fa'
                    ? 'هر آنچه از تاریخچه، افراد مرتبط، زمان رویداد یا جزئیات مکان می‌دانید بنویسید...'
                    : 'Share historical context, names, dates, or stories associated with this entry...'
                }
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#806B50]/30 text-sm text-[#1C1917] focus:outline-none focus:border-[#254B36]"
              />
            </div>

            {/* Optional Geographic Coordinates */}
            <div className="p-3.5 rounded-lg bg-[#EBE6DF]/70 border border-[#806B50]/20 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#1C1917] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#254B36]" />
                  {lang === 'fa'
                    ? 'مختصات جغرافیایی روی نقشه برزک (اختیاری)'
                    : 'Geographic Location on Map (Optional)'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLatitude(String(BARZOK_CENTER.lat));
                      setLongitude(String(BARZOK_CENTER.lng));
                    }}
                    className="px-2.5 py-1 rounded bg-[#F5F2E9] border border-[#806B50]/30 text-[11px] text-[#57534E] hover:text-[#1C1917]"
                  >
                    {lang === 'fa' ? 'مرکز برزک' : 'Barzok Center'}
                  </button>
                  <button
                    type="button"
                    onClick={onRequestMapPick}
                    className="px-2.5 py-1 rounded bg-[#254B36] text-[#F5F2E9] text-[11px] font-medium hover:bg-[#1d3b2a]"
                  >
                    {lang === 'fa' ? 'انتخاب نقطه از روی نقشه' : 'Pick on Map'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#57534E] mb-1">
                    {lang === 'fa' ? 'عرض جغرافیایی (Latitude)' : 'Latitude'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="33.7925"
                    className="w-full px-3 py-1.5 rounded bg-white border border-[#806B50]/30 text-xs font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#57534E] mb-1">
                    {lang === 'fa' ? 'طول جغرافیایی (Longitude)' : 'Longitude'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="51.2292"
                    className="w-full px-3 py-1.5 rounded bg-white border border-[#806B50]/30 text-xs font-mono-num"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                {lang === 'fa'
                  ? 'پیوند تصویر قدیمی یا فایل صوتی (اختیاری)'
                  : 'Photograph or Audio URL (Optional)'}
              </label>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-[#806B50]/30 text-sm text-[#1C1917] font-mono-num focus:outline-none focus:border-[#254B36]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                  {lang === 'fa' ? 'نام و نام خانوادگی شما *' : 'Your Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={contributorName}
                  onChange={(e) => setContributorName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#806B50]/30 text-sm text-[#1C1917] focus:outline-none focus:border-[#254B36]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                  {lang === 'fa'
                    ? 'اطلاعات تماس (محرمانه — هرگز عمومی نمی‌شود) *'
                    : 'Contact Info (Private — never displayed publicly) *'}
                </label>
                <input
                  type="text"
                  required
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder={lang === 'fa' ? 'شماره تماس یا ایمیل' : 'Phone or email'}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#806B50]/30 text-sm text-[#1C1917] focus:outline-none focus:border-[#254B36]"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#EBE6DF]/60 border border-[#806B50]/20 cursor-pointer">
              <input
                type="checkbox"
                checked={consentToPublish}
                onChange={(e) => setConsentToPublish(e.target.checked)}
                className="mt-1 accent-[#254B36]"
              />
              <span className="text-xs text-[#292524] leading-relaxed">
                {lang === 'fa'
                  ? 'رضایت دارم اطلاعات و روایت ارسالی پس از بررسی علمی و تایید مدیران در «مردمنگار برزک» منتشر شود. اطلاعات تماس من کاملاً خصوصی باقی خواهد ماند.'
                  : 'I consent to the publication of this contribution on Barzok People Map after editorial review. My contact details will remain strictly confidential.'}
              </span>
            </label>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[#57534E] flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-[#254B36]" />
                {lang === 'fa'
                  ? 'ارسال به صف بررسی مدیریت (Moderation Queue)'
                  : 'Routed to Moderation Queue'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-[#57534E] hover:bg-[#EBE6DF]"
                >
                  {lang === 'fa' ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium hover:bg-[#1d3b2a] disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {submitting
                      ? lang === 'fa'
                        ? 'در حال ارسال...'
                        : 'Submitting...'
                      : lang === 'fa'
                      ? 'ثبت مشارکت'
                      : 'Submit Contribution'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
