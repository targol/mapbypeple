import { PlaceMediaManager } from './PlaceMediaManager';
import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  Code2,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  LogIn,
  LogOut,
  MapPin,
  Plus,
  Route as RouteIcon,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DATA_SOURCE, apiRequest, resetLocalData } from '../data/api';
import {
  AdminBundle,
  BARZOK_CENTER,
  Language,
  LayerRecord,
  PlaceRecord,
  PublicMapBundle,
} from '../types';
import { AVAILABLE_LAYER_ICONS, LayerIcon } from './LayerIcon';
import { BarzokMapCanvas } from './BarzokMapCanvas';

interface AdminDashboardProps {
  lang: Language;
  publicBundle: PublicMapBundle;
  onRefreshPublic: () => Promise<void>;
  onExitAdmin: () => void;
}

type AdminTab =
  | 'layers'
  | 'places'
  | 'people'
  | 'stories'
  | 'events'
  | 'routes'
  | 'media'
  | 'wpmedia'
  | 'moderation'
  | 'embed';

export function AdminDashboard({
  lang,
  publicBundle,
  onRefreshPublic,
  onExitAdmin,
}: AdminDashboardProps) {
  const {
    user,
    getFreshToken,
    enterPreviewAdmin,
    logout,
    authError,
  } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('layers');
  const [adminData, setAdminData] = useState<AdminBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Layer Form State
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [layerNameFa, setLayerNameFa] = useState('');
  const [layerNameEn, setLayerNameEn] = useState('');
  const [layerDescFa, setLayerDescFa] = useState('');
  const [layerIcon, setLayerIcon] = useState('landmark');
  const [layerColor, setLayerColor] = useState('#254B36');
  const [layerOrder, setLayerOrder] = useState(1);
  const [layerActive, setLayerActive] = useState(true);
  const [confirmDeleteLayerId, setConfirmDeleteLayerId] = useState<string | null>(null);

  // Place Form State
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [placeNameFa, setPlaceNameFa] = useState('');
  const [placeNameEn, setPlaceNameEn] = useState('');
  const [placeLayerId, setPlaceLayerId] = useState(publicBundle.layers[0]?.id || '');
  const [placeCategory, setPlaceCategory] = useState('میراث و معماری');
  const [placeLat, setPlaceLat] = useState<number>(BARZOK_CENTER.lat);
  const [placeLng, setPlaceLng] = useState<number>(BARZOK_CENTER.lng);
  const [googleMapsCoordsPaste, setGoogleMapsCoordsPaste] = useState('');
  const [placeShortIntroFa, setPlaceShortIntroFa] = useState('');
  const [placeFullDescFa, setPlaceFullDescFa] = useState('');
  const [placeHistoricalInfoFa, setPlaceHistoricalInfoFa] = useState('');
  const [placeCurrentStatusFa, setPlaceCurrentStatusFa] = useState('');
  const [placePhotoUrl, setPlacePhotoUrl] = useState('');
  const [placePhotoCaption, setPlacePhotoCaption] = useState('');
  const [placeAudioUrl, setPlaceAudioUrl] = useState('');
  const [placeVideoUrl, setPlaceVideoUrl] = useState('');
  const [placeSourceRef, setPlaceSourceRef] = useState('');
  const [placeDocDate, setPlaceDocDate] = useState('۱۴۰۵');
  const [placePubStatus, setPlacePubStatus] = useState<'published' | 'draft'>('published');
  const [placeVerStatus, setPlaceVerStatus] = useState<'verified' | 'community' | 'demo'>('verified');
  const [placeSelectedPeople, setPlaceSelectedPeople] = useState<string[]>([]);
  const [placeSelectedStories, setPlaceSelectedStories] = useState<string[]>([]);

  // People Form State
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [personNameFa, setPersonNameFa] = useState('');
  const [personOccupationFa, setPersonOccupationFa] = useState('');
  const [personBioFa, setPersonBioFa] = useState('');
  const [personEra, setPersonEra] = useState('');

  // Story Form State
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [storyTitleFa, setStoryTitleFa] = useState('');
  const [storySummaryFa, setStorySummaryFa] = useState('');
  const [storyContentFa, setStoryContentFa] = useState('');
  const [storyNarrator, setStoryNarrator] = useState('');

  // Event Form State
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventTitleFa, setEventTitleFa] = useState('');
  const [eventSeasonFa, setEventSeasonFa] = useState('');
  const [eventDescFa, setEventDescFa] = useState('');
  const [eventPlaceId, setEventPlaceId] = useState('');

  // Route Form State
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routeTitleFa, setRouteTitleFa] = useState('');
  const [routeDescFa, setRouteDescFa] = useState('');
  const [routeDuration, setRouteDuration] = useState(60);
  const [routeDistance, setRouteDistance] = useState(1.5);
  const [routeDifficulty, setRouteDifficulty] = useState('easy');
  const [routeColor, setRouteColor] = useState('#D6A83F');
  const [routeStopPlaceIds, setRouteStopPlaceIds] = useState<string[]>([]);

  // Media Form State
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [mediaTitleFa, setMediaTitleFa] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('recent_photo');
  const [mediaCaptionFa, setMediaCaptionFa] = useState('');

  const fetchAdminData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const data = await apiRequest<AdminBundle>('GET', '/api/admin/bundle', undefined, { token });
      setAdminData(data);
      if (data.layers.length > 0 && !placeLayerId) {
        setPlaceLayerId(data.layers[0].id);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'خطا در ارتباط با سرور' });
    } finally {
      setLoading(false);
    }
  }, [user, getFreshToken, placeLayerId]);

  useEffect(() => {
    if (user) {
      fetchAdminData();
    }
  }, [user, fetchAdminData]);

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = await getFreshToken();
    if (!token) throw new Error('لطفاً ابتدا با حساب مدیر وارد شوید.');
    // Same call shape as before (url + fetch-style options), now routed through the data layer
    // so it works against the local JSON/localStorage backend or a remote one.
    const method = ((options.method as string) || 'GET').toUpperCase() as
      | 'GET'
      | 'POST'
      | 'PUT'
      | 'DELETE';
    const body = options.body ? JSON.parse(options.body as string) : undefined;
    return apiRequest(method, url, body, { token });
  };

  const handleResetDemoData = async () => {
    const ok = window.confirm(
      lang === 'fa'
        ? 'همه‌ی تغییرات این مرورگر پاک شده و داده‌های نمایشی اولیه بازگردانده می‌شوند. ادامه می‌دهید؟'
        : 'This clears all edits stored in this browser and restores the original demo data. Continue?'
    );
    if (!ok) return;
    resetLocalData();
    await fetchAdminData();
    await onRefreshPublic();
    setStatusMessage({
      type: 'success',
      text: lang === 'fa' ? 'داده‌های نمایشی بازنشانی شد.' : 'Demo data has been reset.',
    });
  };

  // Layer Handlers
  const handleSaveLayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    try {
      if (editingLayerId) {
        await authFetch(`/api/admin/layers/${editingLayerId}`, {
          method: 'PUT',
          body: JSON.stringify({
            nameFa: layerNameFa,
            nameEn: layerNameEn || null,
            descriptionFa: layerDescFa || null,
            icon: layerIcon,
            color: layerColor,
            displayOrder: Number(layerOrder),
            isActive: layerActive,
            isDemo: false,
          }),
        });
        setStatusMessage({ type: 'success', text: 'لایه با موفقیت ویرایش شد.' });
      } else {
        await authFetch('/api/admin/layers', {
          method: 'POST',
          body: JSON.stringify({
            nameFa: layerNameFa,
            nameEn: layerNameEn || null,
            descriptionFa: layerDescFa || null,
            icon: layerIcon,
            color: layerColor,
            displayOrder: Number(layerOrder),
            isActive: layerActive,
            isVisible: true,
            isDemo: false,
          }),
        });
        setStatusMessage({ type: 'success', text: 'لایه جدید با موفقیت ایجاد شد.' });
      }
      setEditingLayerId(null);
      setLayerNameFa('');
      setLayerNameEn('');
      setLayerDescFa('');
      await fetchAdminData();
      await onRefreshPublic();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleEditLayerClick = (layer: LayerRecord) => {
    setEditingLayerId(layer.id);
    setLayerNameFa(layer.nameFa);
    setLayerNameEn(layer.nameEn || '');
    setLayerDescFa(layer.descriptionFa || '');
    setLayerIcon(layer.icon);
    setLayerColor(layer.color);
    setLayerOrder(layer.displayOrder);
    setLayerActive(layer.isActive);
  };

  const handleToggleLayerActive = async (layer: LayerRecord) => {
    try {
      await authFetch(`/api/admin/layers/${layer.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !layer.isActive }),
      });
      await fetchAdminData();
      await onRefreshPublic();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteLayer = async (id: string) => {
    try {
      await authFetch(`/api/admin/layers/${id}`, { method: 'DELETE' });
      setConfirmDeleteLayerId(null);
      setStatusMessage({ type: 'success', text: 'لایه حذف شد.' });
      await fetchAdminData();
      await onRefreshPublic();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  // Location / Place Handlers
  const handleSavePlace = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    try {
      const recentPhotos = placePhotoUrl
        ? [{ url: placePhotoUrl, captionFa: placePhotoCaption || placeNameFa, year: placeDocDate }]
        : [];
      const audioRecordings = placeAudioUrl
        ? [{ url: placeAudioUrl, titleFa: `روایت صوتی ${placeNameFa}` }]
        : [];
      const videoLinks = placeVideoUrl
        ? [{ url: placeVideoUrl, titleFa: `ویدیوی ${placeNameFa}` }]
        : [];

      const payload = {
        layerId: placeLayerId || null,
        nameFa: placeNameFa,
        nameEn: placeNameEn || null,
        category: placeCategory,
        shortIntroFa: placeShortIntroFa || placeNameFa,
        fullDescriptionFa: placeFullDescFa || placeShortIntroFa || placeNameFa,
        latitude: Number(placeLat),
        longitude: Number(placeLng),
        historicalInfoFa: placeHistoricalInfoFa || null,
        currentStatusFa: placeCurrentStatusFa || null,
        recentPhotos: placePhotoUrl ? recentPhotos : undefined,
        audioRecordings: placeAudioUrl ? audioRecordings : undefined,
        videoLinks: placeVideoUrl ? videoLinks : undefined,
        sourceReference: placeSourceRef || null,
        documentationDate: placeDocDate || null,
        publicationStatus: placePubStatus,
        verificationStatus: placeVerStatus,
        isDemo: placeVerStatus === 'demo',
        personIds: placeSelectedPeople,
        storyIds: placeSelectedStories,
      };

      if (editingPlaceId) {
        await authFetch(`/api/admin/places/${editingPlaceId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setStatusMessage({ type: 'success', text: 'اطلاعات مکان بروزرسانی شد.' });
      } else {
        await authFetch('/api/admin/places', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setStatusMessage({ type: 'success', text: 'مکان جدید روی نقشه برزک ثبت شد.' });
      }

      setEditingPlaceId(null);
      setPlaceNameFa('');
      setPlaceNameEn('');
      setPlaceShortIntroFa('');
      setPlaceFullDescFa('');
      setPlaceHistoricalInfoFa('');
      setPlaceCurrentStatusFa('');
      setPlacePhotoUrl('');
      setPlacePhotoCaption('');
      setPlaceAudioUrl('');
      setPlaceVideoUrl('');
      setPlaceSelectedPeople([]);
      setPlaceSelectedStories([]);
      await fetchAdminData();
      await onRefreshPublic();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleEditPlaceClick = (p: PlaceRecord) => {
    setEditingPlaceId(p.id);
    setPlaceNameFa(p.nameFa);
    setPlaceNameEn(p.nameEn || '');
    setPlaceLayerId(p.layerId || publicBundle.layers[0]?.id || '');
    setPlaceCategory(p.category);
    setPlaceLat(p.latitude);
    setPlaceLng(p.longitude);
    setPlaceShortIntroFa(p.shortIntroFa);
    setPlaceFullDescFa(p.fullDescriptionFa);
    setPlaceHistoricalInfoFa(p.historicalInfoFa || '');
    setPlaceCurrentStatusFa(p.currentStatusFa || '');
    setPlaceSourceRef(p.sourceReference || '');
    setPlaceDocDate(p.documentationDate || '');
    setPlacePubStatus(p.publicationStatus === 'draft' ? 'draft' : 'published');
    setPlaceVerStatus(p.verificationStatus);

    // Populate media fields if present on the place record
    try {
      const recentArr =
        typeof p.recentPhotos === 'string' ? JSON.parse(p.recentPhotos) : p.recentPhotos || [];
      const histArr =
        typeof p.historicalPhotos === 'string'
          ? JSON.parse(p.historicalPhotos)
          : p.historicalPhotos || [];
      const firstPhoto = recentArr[0] || histArr[0];
      setPlacePhotoUrl(firstPhoto?.url || '');
      setPlacePhotoCaption(firstPhoto?.captionFa || '');
    } catch {
      setPlacePhotoUrl('');
      setPlacePhotoCaption('');
    }

    try {
      const audioArr =
        typeof p.audioRecordings === 'string'
          ? JSON.parse(p.audioRecordings)
          : p.audioRecordings || [];
      setPlaceAudioUrl(audioArr[0]?.url || '');
    } catch {
      setPlaceAudioUrl('');
    }

    try {
      const videoArr =
        typeof p.videoLinks === 'string' ? JSON.parse(p.videoLinks) : p.videoLinks || [];
      setPlaceVideoUrl(videoArr[0]?.url || '');
    } catch {
      setPlaceVideoUrl('');
    }

    // Populate linked people & stories
    const allPP = adminData?.placePeople || publicBundle.placePeople || [];
    const allPS = adminData?.placeStories || publicBundle.placeStories || [];
    setPlaceSelectedPeople(allPP.filter((rel) => rel.placeId === p.id).map((rel) => rel.personId));
    setPlaceSelectedStories(allPS.filter((rel) => rel.placeId === p.id).map((rel) => rel.storyId));

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTogglePlacePublish = async (p: PlaceRecord) => {
    const nextStatus = p.publicationStatus === 'published' ? 'draft' : 'published';
    try {
      await authFetch(`/api/admin/places/${p.id}`, {
        method: 'PUT',
        body: JSON.stringify({ publicationStatus: nextStatus }),
      });
      await fetchAdminData();
      await onRefreshPublic();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeletePlace = async (id: string) => {
    try {
      await authFetch(`/api/admin/places/${id}`, { method: 'DELETE' });
      setStatusMessage({ type: 'success', text: 'مکان حذف شد.' });
      await fetchAdminData();
      await onRefreshPublic();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const activeLayers = adminData?.layers || publicBundle.layers;
  const activePlaces = adminData?.places || publicBundle.places;
  const embedUrl = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}?embed=1`;
  const iframeSnippet = `<iframe src="${embedUrl}" width="100%" height="680" style="border:0; border-radius: 12px; overflow: hidden;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="مردمنگار برزک | Barzok People Map"></iframe>`;

  return (
    <div className="min-h-screen bg-[#F5F2E9] text-[#1C1917] flex flex-col">
      {/* Admin Top Header */}
      <header className="flex items-center justify-between gap-6 px-6 py-4 bg-[#254B36] text-[#F5F2E9] border-b border-[#1C1917]/10">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold whitespace-nowrap">
            {lang === 'fa' ? 'پنل مدیریت مردمنگار برزک' : 'Barzok People Map — Admin CMS'}
          </span>
          <span className="text-xs text-[#F5F2E9]/70 hidden sm:inline">
            /admin
          </span>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-[#F5F2E9]/85 hidden md:inline">
              {user.email}
            </span>
          )}
          {user && DATA_SOURCE === 'local' && (
            <button
              type="button"
              onClick={handleResetDemoData}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs transition-colors whitespace-nowrap"
              title={
                lang === 'fa'
                  ? 'پاک کردن تغییرات این مرورگر و بازگشت به داده‌های اولیه'
                  : 'Clear this browser\'s edits and restore the seed data'
              }
            >
              {lang === 'fa' ? 'بازنشانی داده‌های نمایشی' : 'Reset demo data'}
            </button>
          )}
          {user && (
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'خروج' : 'Sign Out'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onExitAdmin}
            className="px-3.5 py-1.5 rounded-lg bg-[#D6A83F] text-[#1C1917] text-xs font-semibold hover:bg-[#c4962f] transition-colors whitespace-nowrap"
          >
            {lang === 'fa' ? 'بازگشت به نقشه عمومی' : 'Back to Public Map'}
          </button>
        </div>
      </header>

      {/* Authentication Gate */}
      {!user ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-[#806B50]/25 rounded-xl p-8 shadow-sm text-center space-y-5">
            <div className="w-12 h-12 rounded-full bg-[#254B36]/10 text-[#254B36] flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-[#1C1917]">
                {lang === 'fa' ? 'ورود مدیران سامانه' : 'Administrator Sign-In'}
              </h1>
              <p className="text-xs text-[#57534E] leading-relaxed">
                {lang === 'fa'
                  ? 'برای مدیریت پویا لایه‌های موضوعی، افزودن مکان‌ها روی نقشه، مدیریت داستان‌ها و بررسی مشارکت‌های مردمی، با حساب مدیریتی خود وارد شوید.'
                  : 'Enter the demo admin dashboard to manage dynamic map layers, locations, oral histories, and community submissions. Edits are stored only in this browser.'}
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-[#D6A83F]/20 border border-[#D6A83F] text-[#1C1917] text-xs leading-relaxed">
                {authError}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={enterPreviewAdmin}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#254B36] text-[#F5F2E9] text-sm font-medium hover:bg-[#1d3b2a] transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {lang === 'fa'
                    ? 'ورود به پنل مدیریت (حالت نمایشی محلی)'
                    : 'Enter Admin Dashboard (Local Demo Mode)'}
                </span>
              </button>
              <p className="text-[11px] text-[#806B50] leading-relaxed">
                {lang === 'fa'
                  ? 'احراز هویت واقعی در این نسخه وجود ندارد؛ برای انتشار عمومی باید ورود امن جایگزین شود.'
                  : 'There is no real authentication in this version; add secure sign-in before a public launch.'}
              </p>
            </div>

            <div className="pt-4 border-t border-[#806B50]/20 text-start space-y-2">
              <div className="text-xs font-semibold text-[#806B50]">
                {lang === 'fa'
                  ? 'راهنمای جاسازی در وردپرس (Embed Mode):'
                  : 'WordPress Elementor Embed Endpoint:'}
              </div>
              <code className="block p-2.5 rounded bg-[#EBE6DF] text-[11px] font-mono-num text-[#1C1917] break-all">
                {embedUrl}
              </code>
            </div>
          </div>
        </div>
      ) : (
        /* Authenticated CMS Workspace */
        <div className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#806B50]/20">
            {[
              { id: 'layers', labelFa: 'مدیریت لایه‌ها', labelEn: 'Layers', icon: Layers },
              { id: 'places', labelFa: 'مدیریت مکان‌ها', labelEn: 'Locations', icon: MapPin },
              { id: 'people', labelFa: 'افراد و مشاغل', labelEn: 'People', icon: Users },
              { id: 'stories', labelFa: 'داستان‌ها و خاطرات', labelEn: 'Stories', icon: BookOpen },
              { id: 'events', labelFa: 'رویدادها و آیین‌ها', labelEn: 'Events', icon: Calendar },
              { id: 'routes', labelFa: 'مسیرهای پیاده‌روی', labelEn: 'Routes', icon: RouteIcon },
              { id: 'wpmedia', labelFa: 'رسانه‌ی مکان‌ها (وردپرس)', labelEn: 'Place media (WordPress)', icon: ImageIcon },
              { id: 'media', labelFa: 'رسانه و عکس‌ها', labelEn: 'Media', icon: ImageIcon },
              {
                id: 'moderation',
                labelFa: `مشارکت‌های مردمی (${adminData?.contributions.filter((c) => c.moderationStatus === 'pending_review').length || 0})`,
                labelEn: 'Moderation Queue',
                icon: AlertCircle,
              },
              { id: 'embed', labelFa: 'جاسازی در وردپرس (iframe)', labelEn: 'WP Embed', icon: Code2 },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#254B36] text-[#F5F2E9]'
                      : 'bg-[#EBE6DF]/70 text-[#57534E] hover:text-[#1C1917] hover:bg-[#EBE6DF]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{lang === 'fa' ? tab.labelFa : tab.labelEn}</span>
                </button>
              );
            })}
          </div>

          {statusMessage && (
            <div
              className={`p-3.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                statusMessage.type === 'success'
                  ? 'bg-[#254B36]/10 text-[#254B36] border border-[#254B36]/30'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <span>{statusMessage.text}</span>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-xs underline"
              >
                {lang === 'fa' ? 'بستن' : 'Dismiss'}
              </button>
            </div>
          )}

          {loading && (
            <div className="text-xs text-[#806B50]">
              {lang === 'fa' ? 'در حال بروزرسانی داده‌ها...' : 'Refreshing database records...'}
            </div>
          )}

          {/* TAB A: LAYER MANAGEMENT */}
          {activeTab === 'layers' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={handleSaveLayer}
                className="lg:col-span-5 bg-white p-6 rounded-xl border border-[#806B50]/20 space-y-4 h-fit"
              >
                <h2 className="text-base font-bold text-[#1C1917]">
                  {editingLayerId
                    ? lang === 'fa'
                      ? 'ویرایش لایه موضوعی'
                      : 'Edit Thematic Layer'
                    : lang === 'fa'
                    ? 'ایجاد لایه موضوعی جدید'
                    : 'Create New Thematic Layer'}
                </h2>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {lang === 'fa' ? 'نام فارسی لایه *' : 'Persian Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={layerNameFa}
                    onChange={(e) => setLayerNameFa(e.target.value)}
                    placeholder="مثلاً: قنات‌ها و آسیاب‌های آبی"
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {lang === 'fa' ? 'نام انگلیسی (اختیاری)' : 'English Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={layerNameEn}
                    onChange={(e) => setLayerNameEn(e.target.value)}
                    placeholder="e.g., Qanats & Watermills"
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {lang === 'fa' ? 'توضیحات لایه' : 'Description'}
                  </label>
                  <textarea
                    rows={2}
                    value={layerDescFa}
                    onChange={(e) => setLayerDescFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'آیکون' : 'Icon'}
                    </label>
                    <select
                      value={layerIcon}
                      onChange={(e) => setLayerIcon(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-[#806B50]/30 text-xs"
                    >
                      {AVAILABLE_LAYER_ICONS.map((ic) => (
                        <option key={ic.id} value={ic.id}>
                          {lang === 'fa' ? ic.labelFa : ic.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'رنگ اختصاصی' : 'Custom Color'}
                    </label>
                    <input
                      type="color"
                      value={layerColor}
                      onChange={(e) => setLayerColor(e.target.value)}
                      className="w-full h-9 rounded-lg border border-[#806B50]/30 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'ترتیب نمایش' : 'Display Order'}
                    </label>
                    <input
                      type="number"
                      value={layerOrder}
                      onChange={(e) => setLayerOrder(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm font-mono-num"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={layerActive}
                    onChange={(e) => setLayerActive(e.target.checked)}
                    className="accent-[#254B36]"
                  />
                  <span>{lang === 'fa' ? 'لایه فعال و قابل نمایش در نقشه عمومی' : 'Layer Active'}</span>
                </label>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium hover:bg-[#1d3b2a]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {editingLayerId
                        ? lang === 'fa'
                          ? 'ذخیره تغییرات لایه'
                          : 'Update Layer'
                        : lang === 'fa'
                        ? 'افزودن لایه جدید'
                        : 'Create Layer'}
                    </span>
                  </button>
                  {editingLayerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLayerId(null);
                        setLayerNameFa('');
                        setLayerNameEn('');
                        setLayerDescFa('');
                      }}
                      className="px-3 py-2 rounded-lg bg-[#EBE6DF] text-xs"
                    >
                      {lang === 'fa' ? 'انصراف' : 'Cancel'}
                    </button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-7 space-y-3">
                <h3 className="text-base font-bold text-[#1C1917]">
                  {lang === 'fa'
                    ? `لایه‌های ثبت‌شده در پایگاه داده (${activeLayers.length})`
                    : `Database Layers (${activeLayers.length})`}
                </h3>
                {activeLayers.map((layer) => {
                  const count = activePlaces.filter((p) => p.layerId === layer.id).length;
                  return (
                    <div
                      key={layer.id}
                      className="p-4 bg-white rounded-xl border border-[#806B50]/20 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          style={{ backgroundColor: layer.color }}
                          className="w-10 h-10 rounded-full text-[#F5F2E9] flex items-center justify-center shrink-0"
                        >
                          <LayerIcon name={layer.icon} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#1C1917] truncate">
                              {layer.nameFa}
                            </span>
                            {layer.nameEn && (
                              <span className="text-xs text-[#806B50] font-display-en">
                                ({layer.nameEn})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#57534E] flex items-center gap-2 mt-0.5">
                            <span className="font-mono-num">
                              {lang === 'fa' ? `${count} مکان` : `${count} locations`}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num">
                              {lang === 'fa' ? `ترتیب: ${layer.displayOrder}` : `Order: ${layer.displayOrder}`}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {layer.isActive
                                ? lang === 'fa'
                                  ? 'فعال'
                                  : 'Active'
                                : lang === 'fa'
                                ? 'غیرفعال'
                                : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleLayerActive(layer)}
                          title={lang === 'fa' ? 'تغییر وضعیت فعال/غیرفعال' : 'Toggle active'}
                          className="p-2 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE] text-[#1C1917]"
                        >
                          {layer.isActive ? (
                            <Eye className="w-4 h-4 text-[#254B36]" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-[#806B50]" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditLayerClick(layer)}
                          className="p-2 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE] text-[#1C1917]"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {confirmDeleteLayerId === layer.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteLayer(layer.id)}
                              className="px-2.5 py-1 rounded bg-red-700 text-white text-xs"
                            >
                              {lang === 'fa' ? 'تایید حذف' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteLayerId(null)}
                              className="px-2 py-1 rounded bg-[#EBE6DF] text-xs"
                            >
                              {lang === 'fa' ? 'لغو' : 'No'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteLayerId(layer.id)}
                            className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB B: LOCATION MANAGEMENT */}
          {activeTab === 'places' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={handleSavePlace}
                className="lg:col-span-6 bg-white p-6 rounded-xl border border-[#806B50]/20 space-y-4"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-[#1C1917]">
                    {editingPlaceId
                      ? lang === 'fa'
                        ? 'ویرایش مکان'
                        : 'Edit Location'
                      : lang === 'fa'
                      ? 'افزودن مکان جدید به نقشه برزک'
                      : 'Add New Location to Barzok Map'}
                  </h2>

                  <button
                    type="button"
                    onClick={() => {
                      setPlaceNameFa('آسیاب آبی تاریخی محله مصلی');
                      setPlaceNameEn('Historic Watermill of Mosalla Neighborhood');
                      if (activeLayers[0]) {
                        setPlaceLayerId(activeLayers[0].id);
                        setPlaceCategory(activeLayers[0].nameFa);
                      }
                      setPlaceLat(33.7932);
                      setPlaceLng(51.2284);
                      setPlaceShortIntroFa(
                        'یکی از آسیاب‌های آبی قدیمی برزک در مسیر جریان آب قنات و جویبار کوهستانی.'
                      );
                      setPlaceFullDescFa(
                        'این آسیاب آبی در گذشته برای آرد کردن گندم و غلات اهالی برزک با نیروی آب قنات کاربرد داشته و بخشی از میراث مهندسی آب و معماری بومی شهر برزک به شمار می‌رود.'
                      );
                      setPlaceHistoricalInfoFa('دوره قاجار — بازسازی‌شده در دهه‌های اخیر');
                      setPlaceCurrentStatusFa('پابرجا و قابل بازدید در مسیر پیاده‌روی محله');
                      setPlacePhotoUrl(
                        '/src/assets/images/barzok_historic_architecture_1794421049133.jpg'
                      );
                      setPlacePhotoCaption('نمای بافت تاریخی و مسیر آسیاب');
                      setPlaceSourceRef('پژوهش میدانی مردمنگار برزک');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#D6A83F]/25 hover:bg-[#D6A83F]/40 text-[#1C1917] text-xs font-semibold transition-colors"
                  >
                    {lang === 'fa'
                      ? '✨ پر کردن خودکار با یک نمونه آماده (جهت تست سریع)'
                      : '✨ Auto-fill Sample Location'}
                  </button>
                </div>

                {/* Inline Helper Box answering "این مقادیر رو از کجا بیارم؟" */}
                <div className="p-3.5 rounded-xl bg-[#F5F2E9] border border-[#806B50]/25 text-xs text-[#292524] space-y-1.5 leading-relaxed">
                  <div className="font-bold text-[#254B36]">
                    راهنمای سریع: مقادیر این فرم را از کجا بیاوریم؟
                  </div>
                  <ul className="list-disc ps-4 space-y-1 text-[11px] text-[#57534E]">
                    <li>
                      <strong>فقط «نام فارسی مکان» الزامی است!</strong> سایر بخش‌ها در صورت خالی بودن به‌طور خودکار تنظیم می‌شوند.
                    </li>
                    <li>
                      <strong>مختصات جغرافیایی (Latitude / Longitude):</strong> کافی است <strong>روی نقشه سمت چپ کلیک کنید</strong> تا اعداد خودکار وارد شوند؛ یا در Google Maps روی نقطه دلخواه راست‌کلیک کرده و عدد اول را در کادر زیر جایگذاری (Paste) کنید.
                    </li>
                    <li>
                      <strong>تصویر مکان:</strong> نیازی به لینک اینترنتی ندارید؛ می‌توانید <strong>از کامپیوتر/گوشی خود عکس آپلود کنید</strong> یا یکی از تصاویر آماده برزک را با یک کلیک انتخاب نمایید.
                    </li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'نام فارسی مکان (الزامی) *' : 'Persian Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثلاً: حمام تاریخی برزک یا خانه سنتی..."
                      value={placeNameFa}
                      onChange={(e) => setPlaceNameFa(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'نام انگلیسی (اختیاری)' : 'English Name (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Historic Bathhouse of Barzok"
                      value={placeNameEn}
                      onChange={(e) => setPlaceNameEn(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'لایه موضوعی اصلی' : 'Primary Layer'}
                    </label>
                    <select
                      value={placeLayerId || activeLayers[0]?.id || ''}
                      onChange={(e) => {
                        setPlaceLayerId(e.target.value);
                        const found = activeLayers.find((l) => l.id === e.target.value);
                        if (found) setPlaceCategory(found.nameFa);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                    >
                      {activeLayers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'دسته‌بندی موضوعی (اختیاری)' : 'Category'}
                    </label>
                    <input
                      type="text"
                      value={placeCategory}
                      onChange={(e) => setPlaceCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                    />
                  </div>
                </div>

                {/* Click-on-Map & Preset Coordinate Picker */}
                <div className="p-3.5 rounded-lg bg-[#EBE6DF]/60 border border-[#806B50]/20 space-y-2.5">
                  <div className="text-xs font-semibold text-[#254B36]">
                    {lang === 'fa'
                      ? 'مختصات جغرافیایی (روش ۱: کلیک روی نقشه روبه‌رو | روش ۲: انتخاب محله آماده | روش ۳: کپی از گوگل مپس)'
                      : 'Coordinates (Click map, pick a preset, or paste from Google Maps)'}
                  </div>

                  {/* Preset Neighborhood Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: 'مرکز بافت تاریخی', lat: 33.7925, lng: 51.2292 },
                      { label: 'محله باغستان و جویبار', lat: 33.7898, lng: 51.2335 },
                      { label: 'محله کارگاه‌های گلاب‌گیری', lat: 33.7941, lng: 51.2318 },
                      { label: 'محله نساجی سنتی', lat: 33.7912, lng: 51.2271 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setPlaceLat(preset.lat);
                          setPlaceLng(preset.lng);
                        }}
                        className="px-2.5 py-1 rounded bg-white hover:bg-[#254B36] hover:text-white border border-[#806B50]/30 text-[11px] transition-colors"
                      >
                        📍 {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Paste Directly from Google Maps Right-Click */}
                  <div>
                    <input
                      type="text"
                      value={googleMapsCoordsPaste}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGoogleMapsCoordsPaste(val);
                        const normalized = val
                          .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                          .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
                        const parts = normalized.split(/[,،\s]+/).filter(Boolean);
                        if (parts.length >= 2) {
                          const pLat = parseFloat(parts[0]);
                          const pLng = parseFloat(parts[1]);
                          if (!Number.isNaN(pLat) && !Number.isNaN(pLng)) {
                            setPlaceLat(pLat);
                            setPlaceLng(pLng);
                          }
                        }
                      }}
                      placeholder="جایگذاری مستقیم از گوگل مپس (مثلاً: 33.7925, 51.2292)"
                      className="w-full px-3 py-1.5 rounded bg-white border border-[#806B50]/30 text-xs font-mono-num"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#57534E] mb-1">
                        عرض جغرافیایی (Latitude)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={placeLat}
                        onChange={(e) => setPlaceLat(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded bg-white border border-[#806B50]/30 text-xs font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#57534E] mb-1">
                        طول جغرافیایی (Longitude)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={placeLng}
                        onChange={(e) => setPlaceLng(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded bg-white border border-[#806B50]/30 text-xs font-mono-num"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {lang === 'fa' ? 'معرفی کوتاه (در صورت خالی بودن از نام مکان پر می‌شود)' : 'Short Introduction'}
                  </label>
                  <input
                    type="text"
                    placeholder="یک جمله کوتاه برای معرفی این مکان..."
                    value={placeShortIntroFa}
                    onChange={(e) => setPlaceShortIntroFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {lang === 'fa' ? 'توضیحات کامل (اختیاری)' : 'Full Description'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder="شرح کامل ویژگی‌ها، معماری، خاطرات یا اهمیت فرهنگی مکان..."
                    value={placeFullDescFa}
                    onChange={(e) => setPlaceFullDescFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'پیشینه تاریخی (اختیاری)' : 'Historical Info'}
                    </label>
                    <input
                      type="text"
                      placeholder="مثلاً: دوره قاجار / پهلوی اول"
                      value={placeHistoricalInfoFa}
                      onChange={(e) => setPlaceHistoricalInfoFa(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'وضعیت کنونی (اختیاری)' : 'Current Status'}
                    </label>
                    <input
                      type="text"
                      placeholder="مثلاً: فعال و دایر / نیازمند مرمت"
                      value={placeCurrentStatusFa}
                      onChange={(e) => setPlaceCurrentStatusFa(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                    />
                  </div>
                </div>

                {/* Image Picker: Upload from Computer OR Pick Built-in Gallery OR Paste URL */}
                <div className="p-3.5 rounded-lg bg-[#EBE6DF]/50 border border-[#806B50]/20 space-y-2.5">
                  <label className="block text-xs font-semibold text-[#1C1917]">
                    {lang === 'fa'
                      ? 'تصویر مکان (اختیاری — آپلود از دستگاه، انتخاب تصویر آماده یا وارد کردن لینک)'
                      : 'Location Photograph (Optional — Upload file, pick preset, or enter URL)'}
                  </label>

                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="px-3 py-1.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium cursor-pointer hover:bg-[#1d3b2a] transition-colors">
                      <span>📁 آپلود عکس از کامپیوتر / موبایل</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              setPlacePhotoUrl(reader.result);
                              if (!placePhotoCaption) {
                                setPlacePhotoCaption(file.name.replace(/\.[^.]+$/, ''));
                              }
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>

                    {[
                      {
                        label: 'معماری پلکانی',
                        url: '/src/assets/images/barzok_historic_architecture_1794421049133.jpg',
                      },
                      {
                        label: 'گلاب‌گیری سنتی',
                        url: '/src/assets/images/barzok_rosewater_tradition_1794421051440.jpg',
                      },
                      {
                        label: 'کارگاه نساجی',
                        url: '/src/assets/images/barzok_textile_weaving_1794421051123.jpg',
                      },
                      {
                        label: 'کوچه‌باغ گردو',
                        url: '/src/assets/images/barzok_walnut_gardens_1794421053291.jpg',
                      },
                    ].map((imgPreset) => (
                      <button
                        key={imgPreset.label}
                        type="button"
                        onClick={() => setPlacePhotoUrl(imgPreset.url)}
                        className="px-2.5 py-1 rounded bg-white hover:bg-[#D6CEBE] border border-[#806B50]/30 text-[11px]"
                      >
                        🖼️ {imgPreset.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        value={placePhotoUrl}
                        onChange={(e) => setPlacePhotoUrl(e.target.value)}
                        placeholder="آدرس تصویر (یا از دکمه‌های بالا انتخاب کنید)"
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#806B50]/30 text-xs font-mono-num"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={placePhotoCaption}
                        onChange={(e) => setPlacePhotoCaption(e.target.value)}
                        placeholder="توضیح زیرنویس عکس (اختیاری)"
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#806B50]/30 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'پیوند فایل صوتی (اختیاری)' : 'Audio URL (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="https://... (در صورت وجود فایل صوتی)"
                      value={placeAudioUrl}
                      onChange={(e) => setPlaceAudioUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-xs font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'پیوند ویدیو (اختیاری)' : 'Video URL (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="https://... (لینک آپارات یا ویدیو در صورت وجود)"
                      value={placeVideoUrl}
                      onChange={(e) => setPlaceVideoUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-xs font-mono-num"
                    />
                  </div>
                </div>

                {/* Connect Location to People & Stories */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'افراد مرتبط با این مکان' : 'Connected People'}
                    </label>
                    <div className="max-h-28 overflow-y-auto p-2 rounded border border-[#806B50]/30 space-y-1 bg-[#F5F2E9]/50">
                      {(adminData?.people || []).map((person) => (
                        <label key={person.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={placeSelectedPeople.includes(person.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPlaceSelectedPeople((prev) => [...prev, person.id]);
                              } else {
                                setPlaceSelectedPeople((prev) =>
                                  prev.filter((id) => id !== person.id)
                                );
                              }
                            }}
                          />
                          <span className="truncate">{person.nameFa}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'داستان‌های مرتبط با این مکان' : 'Connected Stories'}
                    </label>
                    <div className="max-h-28 overflow-y-auto p-2 rounded border border-[#806B50]/30 space-y-1 bg-[#F5F2E9]/50">
                      {(adminData?.stories || []).map((st) => (
                        <label key={st.id} className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={placeSelectedStories.includes(st.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPlaceSelectedStories((prev) => [...prev, st.id]);
                              } else {
                                setPlaceSelectedStories((prev) =>
                                  prev.filter((id) => id !== st.id)
                                );
                              }
                            }}
                          />
                          <span className="truncate">{st.titleFa}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'منبع / ارجاع' : 'Source'}
                    </label>
                    <input
                      type="text"
                      value={placeSourceRef}
                      onChange={(e) => setPlaceSourceRef(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-[#806B50]/30 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'وضعیت انتشار' : 'Publication'}
                    </label>
                    <select
                      value={placePubStatus}
                      onChange={(e) =>
                        setPlacePubStatus(e.target.value as 'published' | 'draft')
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-[#806B50]/30 text-xs"
                    >
                      <option value="published">منتشرشده (Published)</option>
                      <option value="draft">پیش‌نویس (Draft)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {lang === 'fa' ? 'وضعیت اعتبارسنجی' : 'Verification'}
                    </label>
                    <select
                      value={placeVerStatus}
                      onChange={(e) =>
                        setPlaceVerStatus(
                          e.target.value as 'verified' | 'community' | 'demo'
                        )
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-[#806B50]/30 text-xs"
                    >
                      <option value="verified">مستند تاییدشده (Verified)</option>
                      <option value="community">مشارکت مردمی (Community)</option>
                      <option value="demo">نمونه آزمایشی (Demo)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium hover:bg-[#1d3b2a]"
                  >
                    {editingPlaceId
                      ? lang === 'fa'
                        ? 'بروزرسانی مکان'
                        : 'Update Location'
                      : lang === 'fa'
                      ? 'ثبت مکان در نقشه'
                      : 'Create Location'}
                  </button>
                  {editingPlaceId && (
                    <button
                      type="button"
                      onClick={() => setEditingPlaceId(null)}
                      className="px-3 py-2 rounded-lg bg-[#EBE6DF] text-xs"
                    >
                      {lang === 'fa' ? 'انصراف' : 'Cancel'}
                    </button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-6 space-y-5">
                {/* Interactive Coordinate Picker Map */}
                <div className="h-72 rounded-xl overflow-hidden border border-[#806B50]/30 shadow-sm">
                  <BarzokMapCanvas
                    lang={lang}
                    layers={activeLayers}
                    places={activePlaces}
                    activeRoute={null}
                    selectedPlaceId={editingPlaceId}
                    onSelectPlace={(p) => handleEditPlaceClick(p)}
                    pickMode={true}
                    pickedCoords={{ lat: placeLat, lng: placeLng }}
                    onPickCoords={(coords) => {
                      setPlaceLat(coords.lat);
                      setPlaceLng(coords.lng);
                    }}
                  />
                </div>

                {/* Places List */}
                <div className="space-y-2.5">
                  <h3 className="text-sm font-bold text-[#1C1917]">
                    {lang === 'fa'
                      ? `فهرست مکان‌ها (${activePlaces.length})`
                      : `All Locations (${activePlaces.length})`}
                  </h3>
                  {activePlaces.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 bg-white rounded-xl border border-[#806B50]/20 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[#1C1917] truncate">
                          {p.nameFa}
                        </div>
                        <div className="text-xs text-[#57534E] flex items-center gap-2 mt-0.5">
                          <span>{p.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num">
                            {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {p.publicationStatus === 'published' ? 'منتشرشده' : 'پیش‌نویس'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTogglePlacePublish(p)}
                          title={lang === 'fa' ? 'انتشار / لغو انتشار' : 'Publish / Unpublish'}
                          className="p-2 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE]"
                        >
                          {p.publicationStatus === 'published' ? (
                            <Eye className="w-4 h-4 text-[#254B36]" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-[#806B50]" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditPlaceClick(p)}
                          className="p-2 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE]"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlace(p.id)}
                          className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB C1: PEOPLE MANAGEMENT */}
          {activeTab === 'people' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    if (editingPersonId) {
                      await authFetch(`/api/admin/people/${editingPersonId}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                          nameFa: personNameFa,
                          occupationFa: personOccupationFa,
                          bioFa: personBioFa,
                          era: personEra || null,
                        }),
                      });
                      setStatusMessage({ type: 'success', text: 'اطلاعات فرد با موفقیت ویرایش شد.' });
                    } else {
                      await authFetch('/api/admin/people', {
                        method: 'POST',
                        body: JSON.stringify({
                          nameFa: personNameFa,
                          occupationFa: personOccupationFa,
                          bioFa: personBioFa,
                          era: personEra || null,
                          publicationStatus: 'published',
                          verificationStatus: 'verified',
                          isDemo: false,
                        }),
                      });
                      setStatusMessage({ type: 'success', text: 'پرونده فرد با موفقیت ثبت شد.' });
                    }
                    setEditingPersonId(null);
                    setPersonNameFa('');
                    setPersonOccupationFa('');
                    setPersonBioFa('');
                    setPersonEra('');
                    await fetchAdminData();
                    await onRefreshPublic();
                  } catch (err: any) {
                    setStatusMessage({ type: 'error', text: err.message });
                  }
                }}
                className="lg:col-span-5 bg-white p-6 rounded-xl border border-[#806B50]/20 space-y-4 h-fit"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">
                    {editingPersonId
                      ? 'ویرایش پرونده چهره محلی'
                      : lang === 'fa'
                      ? 'ثبت چهره محلی یا پیشه‌ور سنتی'
                      : 'Add Local Person / Artisan'}
                  </h2>
                  {editingPersonId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPersonId(null);
                        setPersonNameFa('');
                        setPersonOccupationFa('');
                        setPersonBioFa('');
                        setPersonEra('');
                      }}
                      className="text-xs text-[#806B50] hover:underline"
                    >
                      انصراف از ویرایش
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">نام و نام خانوادگی *</label>
                  <input
                    type="text"
                    required
                    value={personNameFa}
                    onChange={(e) => setPersonNameFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">پیشه یا مهارت بومی *</label>
                  <input
                    type="text"
                    required
                    value={personOccupationFa}
                    onChange={(e) => setPersonOccupationFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">دوره زمانی / محله</label>
                  <input
                    type="text"
                    value={personEra}
                    onChange={(e) => setPersonEra(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">زندگی‌نامه و روایت مستند *</label>
                  <textarea
                    rows={4}
                    required
                    value={personBioFa}
                    onChange={(e) => setPersonBioFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium hover:bg-[#1d3b2a] transition-colors"
                >
                  {editingPersonId
                    ? 'ذخیره تغییرات فرد'
                    : lang === 'fa'
                    ? 'افزودن به فهرست مردم برزک'
                    : 'Save Person'}
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {(adminData?.people || []).map((person) => (
                  <div
                    key={person.id}
                    className={`p-4 bg-white rounded-xl border flex items-start justify-between gap-4 ${
                      editingPersonId === person.id
                        ? 'border-[#254B36] ring-2 ring-[#254B36]/20'
                        : 'border-[#806B50]/20'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-sm">{person.nameFa}</div>
                      <div className="text-xs text-[#254B36]">{person.occupationFa}</div>
                      {person.era && (
                        <div className="text-[11px] text-[#806B50]">دوره / محله: {person.era}</div>
                      )}
                      <p className="text-xs text-[#57534E] leading-relaxed">{person.bioFa}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPersonId(person.id);
                          setPersonNameFa(person.nameFa);
                          setPersonOccupationFa(person.occupationFa);
                          setPersonBioFa(person.bioFa);
                          setPersonEra(person.era || '');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE] text-xs font-medium text-[#1C1917]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ویرایش</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await authFetch(`/api/admin/people/${person.id}`, { method: 'DELETE' });
                          await fetchAdminData();
                          await onRefreshPublic();
                        }}
                        className="p-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB C2: STORIES MANAGEMENT */}
          {activeTab === 'stories' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    if (editingStoryId) {
                      await authFetch(`/api/admin/stories/${editingStoryId}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                          titleFa: storyTitleFa,
                          summaryFa: storySummaryFa || storyTitleFa,
                          contentFa: storyContentFa,
                          narratorName: storyNarrator || null,
                        }),
                      });
                      setStatusMessage({ type: 'success', text: 'داستان با موفقیت ویرایش شد.' });
                    } else {
                      await authFetch('/api/admin/stories', {
                        method: 'POST',
                        body: JSON.stringify({
                          titleFa: storyTitleFa,
                          summaryFa: storySummaryFa || storyTitleFa,
                          contentFa: storyContentFa,
                          narratorName: storyNarrator || null,
                          publicationStatus: 'published',
                          verificationStatus: 'verified',
                          isDemo: false,
                        }),
                      });
                      setStatusMessage({ type: 'success', text: 'داستان جدید ثبت شد.' });
                    }
                    setEditingStoryId(null);
                    setStoryTitleFa('');
                    setStorySummaryFa('');
                    setStoryContentFa('');
                    setStoryNarrator('');
                    await fetchAdminData();
                    await onRefreshPublic();
                  } catch (err: any) {
                    setStatusMessage({ type: 'error', text: err.message });
                  }
                }}
                className="lg:col-span-5 bg-white p-6 rounded-xl border border-[#806B50]/20 space-y-4 h-fit"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">
                    {editingStoryId
                      ? 'ویرایش داستان و روایت شفاهی'
                      : lang === 'fa'
                      ? 'ثبت داستان، خاطره یا تاریخ شفاهی'
                      : 'Add Oral History / Story'}
                  </h2>
                  {editingStoryId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStoryId(null);
                        setStoryTitleFa('');
                        setStorySummaryFa('');
                        setStoryContentFa('');
                        setStoryNarrator('');
                      }}
                      className="text-xs text-[#806B50] hover:underline"
                    >
                      انصراف از ویرایش
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">عنوان داستان *</label>
                  <input
                    type="text"
                    required
                    value={storyTitleFa}
                    onChange={(e) => setStoryTitleFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">نام راوی</label>
                  <input
                    type="text"
                    value={storyNarrator}
                    onChange={(e) => setStoryNarrator(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">خلاصه کوتاه *</label>
                  <input
                    type="text"
                    required
                    value={storySummaryFa}
                    onChange={(e) => setStorySummaryFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">متن کامل روایت *</label>
                  <textarea
                    rows={5}
                    required
                    value={storyContentFa}
                    onChange={(e) => setStoryContentFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium hover:bg-[#1d3b2a] transition-colors"
                >
                  {editingStoryId
                    ? 'ذخیره تغییرات داستان'
                    : lang === 'fa'
                    ? 'انتشار داستان'
                    : 'Publish Story'}
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {(adminData?.stories || []).map((st) => (
                  <div
                    key={st.id}
                    className={`p-4 bg-white rounded-xl border flex items-start justify-between gap-4 ${
                      editingStoryId === st.id
                        ? 'border-[#254B36] ring-2 ring-[#254B36]/20'
                        : 'border-[#806B50]/20'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-sm">{st.titleFa}</div>
                      {st.narratorName && (
                        <div className="text-xs text-[#806B50]">راوی: {st.narratorName}</div>
                      )}
                      <p className="text-xs text-[#57534E] leading-relaxed">{st.summaryFa}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStoryId(st.id);
                          setStoryTitleFa(st.titleFa);
                          setStorySummaryFa(st.summaryFa);
                          setStoryContentFa(st.contentFa);
                          setStoryNarrator(st.narratorName || '');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE] text-xs font-medium text-[#1C1917]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ویرایش</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await authFetch(`/api/admin/stories/${st.id}`, { method: 'DELETE' });
                          await fetchAdminData();
                          await onRefreshPublic();
                        }}
                        className="p-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB C3: EVENTS MANAGEMENT */}
          {activeTab === 'events' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    if (editingEventId) {
                      await authFetch(`/api/admin/events/${editingEventId}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                          titleFa: eventTitleFa,
                          seasonOrDateFa: eventSeasonFa,
                          descriptionFa: eventDescFa,
                          placeId: eventPlaceId || null,
                        }),
                      });
                      setStatusMessage({ type: 'success', text: 'رویداد فرهنگی با موفقیت ویرایش شد.' });
                    } else {
                      await authFetch('/api/admin/events', {
                        method: 'POST',
                        body: JSON.stringify({
                          titleFa: eventTitleFa,
                          seasonOrDateFa: eventSeasonFa,
                          descriptionFa: eventDescFa,
                          placeId: eventPlaceId || null,
                        }),
                      });
                      setStatusMessage({ type: 'success', text: 'رویداد فرهنگی ثبت شد.' });
                    }
                    setEditingEventId(null);
                    setEventTitleFa('');
                    setEventSeasonFa('');
                    setEventDescFa('');
                    setEventPlaceId('');
                    await fetchAdminData();
                    await onRefreshPublic();
                  } catch (err: any) {
                    setStatusMessage({ type: 'error', text: err.message });
                  }
                }}
                className="lg:col-span-5 bg-white p-6 rounded-xl border border-[#806B50]/20 space-y-4 h-fit"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">
                    {editingEventId ? 'ویرایش رویداد یا آیین فصلی' : 'ثبت رویداد یا آیین فصلی'}
                  </h2>
                  {editingEventId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEventId(null);
                        setEventTitleFa('');
                        setEventSeasonFa('');
                        setEventDescFa('');
                        setEventPlaceId('');
                      }}
                      className="text-xs text-[#806B50] hover:underline"
                    >
                      انصراف از ویرایش
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">عنوان رویداد *</label>
                  <input
                    type="text"
                    required
                    value={eventTitleFa}
                    onChange={(e) => setEventTitleFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">فصل یا زمان برگزاری *</label>
                  <input
                    type="text"
                    required
                    value={eventSeasonFa}
                    onChange={(e) => setEventSeasonFa(e.target.value)}
                    placeholder="مثلاً: اردیبهشت‌ماه"
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">مکان مرتبط روی نقشه</label>
                  <select
                    value={eventPlaceId}
                    onChange={(e) => setEventPlaceId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  >
                    <option value="">بدون مکان خاص</option>
                    {activePlaces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameFa}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">توضیحات رویداد *</label>
                  <textarea
                    rows={3}
                    required
                    value={eventDescFa}
                    onChange={(e) => setEventDescFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium hover:bg-[#1d3b2a] transition-colors"
                >
                  {editingEventId ? 'ذخیره تغییرات رویداد' : 'ثبت رویداد'}
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {(adminData?.events || []).map((ev) => (
                  <div
                    key={ev.id}
                    className={`p-4 bg-white rounded-xl border flex items-start justify-between gap-4 ${
                      editingEventId === ev.id
                        ? 'border-[#254B36] ring-2 ring-[#254B36]/20'
                        : 'border-[#806B50]/20'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">{ev.titleFa}</div>
                      <div className="text-xs text-[#806B50]">{ev.seasonOrDateFa}</div>
                      <p className="text-xs text-[#57534E] mt-1">{ev.descriptionFa}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEventId(ev.id);
                          setEventTitleFa(ev.titleFa);
                          setEventSeasonFa(ev.seasonOrDateFa);
                          setEventDescFa(ev.descriptionFa);
                          setEventPlaceId(ev.placeId || '');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE] text-xs font-medium text-[#1C1917]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ویرایش</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await authFetch(`/api/admin/events/${ev.id}`, { method: 'DELETE' });
                          await fetchAdminData();
                          await onRefreshPublic();
                        }}
                        className="p-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB C4: WALKING ROUTES MANAGEMENT */}
          {activeTab === 'routes' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const payload = {
                      titleFa: routeTitleFa,
                      descriptionFa: routeDescFa,
                      durationMinutes: routeDuration,
                      distanceKm: routeDistance,
                      difficulty: routeDifficulty,
                      color: routeColor,
                      stops: routeStopPlaceIds.map((pid, idx) => ({
                        placeId: pid,
                        stopOrder: idx + 1,
                      })),
                    };

                    if (editingRouteId) {
                      await authFetch(`/api/admin/routes/${editingRouteId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload),
                      });
                      setStatusMessage({
                        type: 'success',
                        text: 'مسیر پیاده‌روی با موفقیت ویرایش و بروزرسانی شد.',
                      });
                    } else {
                      await authFetch('/api/admin/routes', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                      });
                      setStatusMessage({ type: 'success', text: 'مسیر پیاده‌روی جدید ثبت شد.' });
                    }
                    setEditingRouteId(null);
                    setRouteTitleFa('');
                    setRouteDescFa('');
                    setRouteDuration(60);
                    setRouteDistance(1.5);
                    setRouteDifficulty('easy');
                    setRouteColor('#D6A83F');
                    setRouteStopPlaceIds([]);
                    await fetchAdminData();
                    await onRefreshPublic();
                  } catch (err: any) {
                    setStatusMessage({ type: 'error', text: err.message });
                  }
                }}
                className="lg:col-span-5 bg-white p-6 rounded-xl border border-[#806B50]/20 space-y-4 h-fit"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">
                    {editingRouteId
                      ? 'ویرایش مسیر داستانی و پیاده‌روی'
                      : 'ایجاد مسیر داستانی و پیاده‌روی'}
                  </h2>
                  {editingRouteId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRouteId(null);
                        setRouteTitleFa('');
                        setRouteDescFa('');
                        setRouteDuration(60);
                        setRouteDistance(1.5);
                        setRouteDifficulty('easy');
                        setRouteColor('#D6A83F');
                        setRouteStopPlaceIds([]);
                      }}
                      className="text-xs text-[#806B50] hover:underline"
                    >
                      انصراف از ویرایش
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">عنوان مسیر *</label>
                  <input
                    type="text"
                    required
                    value={routeTitleFa}
                    onChange={(e) => setRouteTitleFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">مدت زمان (دقیقه)</label>
                    <input
                      type="number"
                      value={routeDuration}
                      onChange={(e) => setRouteDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">مسافت (کیلومتر)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={routeDistance}
                      onChange={(e) => setRouteDistance(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm font-mono-num"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">درجه سختی مسیر</label>
                    <select
                      value={routeDifficulty}
                      onChange={(e) => setRouteDifficulty(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                    >
                      <option value="easy">آسان (مناسب همگان)</option>
                      <option value="moderate">متوسط (پیاده‌روی محله‌ای)</option>
                      <option value="challenging">کوهستانی / باغستان پلکانی</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">رنگ خط مسیر روی نقشه</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={routeColor}
                        onChange={(e) => setRouteColor(e.target.value)}
                        className="w-10 h-9 rounded border border-[#806B50]/30 cursor-pointer"
                      />
                      <span className="text-xs font-mono-num text-[#57534E]">{routeColor}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    انتخاب ایستگاه‌های مسیر (به ترتیب حرکت)
                  </label>
                  <div className="max-h-44 overflow-y-auto p-2.5 rounded border border-[#806B50]/30 space-y-1.5 bg-[#F5F2E9]/50">
                    {activePlaces.map((p) => {
                      const stopIndex = routeStopPlaceIds.indexOf(p.id);
                      const isChecked = stopIndex !== -1;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 text-xs py-1 px-1.5 rounded hover:bg-white/70"
                        >
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setRouteStopPlaceIds((prev) => [...prev, p.id]);
                                } else {
                                  setRouteStopPlaceIds((prev) => prev.filter((id) => id !== p.id));
                                }
                              }}
                            />
                            <span className="truncate">{p.nameFa}</span>
                          </label>
                          {isChecked && (
                            <span className="px-2 py-0.5 rounded-full bg-[#254B36] text-[#F5F2E9] text-[10px] font-mono-num">
                              ایستگاه {stopIndex + 1}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">توضیحات مسیر *</label>
                  <textarea
                    rows={3}
                    required
                    value={routeDescFa}
                    onChange={(e) => setRouteDescFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium hover:bg-[#1d3b2a] transition-colors"
                >
                  {editingRouteId ? 'ذخیره تغییرات مسیر پیاده‌روی' : 'ثبت مسیر پیاده‌روی'}
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                {(adminData?.routes || []).map((rt) => (
                  <div
                    key={rt.id}
                    className={`p-4 bg-white rounded-xl border flex items-start justify-between gap-4 ${
                      editingRouteId === rt.id
                        ? 'border-[#254B36] ring-2 ring-[#254B36]/20'
                        : 'border-[#806B50]/20'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: rt.color || '#D6A83F' }}
                        />
                        <span className="font-bold text-sm">{rt.titleFa}</span>
                      </div>
                      <div className="text-xs text-[#806B50] font-mono-num mt-0.5">
                        {rt.distanceKm} km · {rt.durationMinutes} min · {rt.stops?.length || 0} ایستگاه
                      </div>
                      <p className="text-xs text-[#57534E] mt-1 leading-relaxed">{rt.descriptionFa}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRouteId(rt.id);
                          setRouteTitleFa(rt.titleFa);
                          setRouteDescFa(rt.descriptionFa);
                          setRouteDuration(rt.durationMinutes || 60);
                          setRouteDistance(rt.distanceKm || 1.5);
                          setRouteDifficulty(rt.difficulty || 'easy');
                          setRouteColor(rt.color || '#D6A83F');
                          const sortedStops = [...(rt.stops || [])].sort(
                            (a, b) => a.stopOrder - b.stopOrder
                          );
                          setRouteStopPlaceIds(sortedStops.map((s) => s.placeId));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE] text-xs font-medium text-[#1C1917]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ویرایش</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await authFetch(`/api/admin/routes/${rt.id}`, { method: 'DELETE' });
                          await fetchAdminData();
                          await onRefreshPublic();
                        }}
                        className="p-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB C5: MEDIA ARCHIVE */}
          {activeTab === 'wpmedia' && <PlaceMediaManager lang={lang} places={publicBundle.places} />}

          {activeTab === 'media' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    if (editingMediaId) {
                      await authFetch(`/api/admin/media/${editingMediaId}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                          titleFa: mediaTitleFa,
                          fileUrl: mediaUrl,
                          mediaType,
                          captionFa: mediaCaptionFa,
                        }),
                      });
                      setStatusMessage({ type: 'success', text: 'رسانه با موفقیت ویرایش شد.' });
                    } else {
                      await authFetch('/api/admin/media', {
                        method: 'POST',
                        body: JSON.stringify({
                          titleFa: mediaTitleFa,
                          fileUrl: mediaUrl,
                          mediaType,
                          captionFa: mediaCaptionFa,
                        }),
                      });
                      setStatusMessage({ type: 'success', text: 'پرونده رسانه‌ای در آرشیو ثبت شد.' });
                    }
                    setEditingMediaId(null);
                    setMediaTitleFa('');
                    setMediaUrl('');
                    setMediaCaptionFa('');
                    await fetchAdminData();
                  } catch (err: any) {
                    setStatusMessage({ type: 'error', text: err.message });
                  }
                }}
                className="lg:col-span-5 bg-white p-6 rounded-xl border border-[#806B50]/20 space-y-4 h-fit"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">
                    {editingMediaId
                      ? 'ویرایش عکس یا سند آرشیوی'
                      : 'افزودن عکس یا سند به آرشیو رسانه'}
                  </h2>
                  {editingMediaId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMediaId(null);
                        setMediaTitleFa('');
                        setMediaUrl('');
                        setMediaCaptionFa('');
                      }}
                      className="text-xs text-[#806B50] hover:underline"
                    >
                      انصراف از ویرایش
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">عنوان رسانه *</label>
                  <input
                    type="text"
                    required
                    value={mediaTitleFa}
                    onChange={(e) => setMediaTitleFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">نوع رسانه</label>
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  >
                    <option value="historical_photo">عکس تاریخی (Historical Photo)</option>
                    <option value="recent_photo">عکس معاصر (Recent Photo)</option>
                    <option value="audio">فایل صوتی (Audio Recording)</option>
                    <option value="video">ویدیو (Video)</option>
                    <option value="document">سند آرشیوی (Document)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold">انتخاب فایل یا آدرس رسانه *</label>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium cursor-pointer hover:bg-[#1d3b2a]">
                    <span>📂 آپلود مستقیم تصویر از دستگاه</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            setMediaUrl(reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  <input
                    type="text"
                    required
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="/src/assets/images/..."
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-xs font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">توضیحات / زیرنویس</label>
                  <textarea
                    rows={2}
                    value={mediaCaptionFa}
                    onChange={(e) => setMediaCaptionFa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#806B50]/30 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-medium hover:bg-[#1d3b2a] transition-colors"
                >
                  {editingMediaId ? 'ذخیره تغییرات رسانه' : 'ذخیره در آرشیو رسانه'}
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                <h3 className="text-sm font-bold">آرشیو رسانه‌ها ({adminData?.media.length || 0})</h3>
                {(adminData?.media || []).map((m) => (
                  <div
                    key={m.id}
                    className={`p-4 bg-white rounded-xl border flex items-center justify-between gap-4 ${
                      editingMediaId === m.id
                        ? 'border-[#254B36] ring-2 ring-[#254B36]/20'
                        : 'border-[#806B50]/20'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-sm">{m.titleFa}</div>
                      <div className="text-xs text-[#806B50] font-mono-num truncate max-w-md">
                        {m.fileUrl.startsWith('data:') ? '[تصویر آپلودشده]' : m.fileUrl}
                      </div>
                      {m.captionFa && (
                        <div className="text-xs text-[#57534E] mt-0.5">{m.captionFa}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMediaId(m.id);
                          setMediaTitleFa(m.titleFa);
                          setMediaUrl(m.fileUrl);
                          setMediaType(m.mediaType);
                          setMediaCaptionFa(m.captionFa || '');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE] text-xs font-medium text-[#1C1917]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ویرایش</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await authFetch(`/api/admin/media/${m.id}`, { method: 'DELETE' });
                          await fetchAdminData();
                        }}
                        className="p-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB D: MODERATION QUEUE */}
          {activeTab === 'moderation' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-bold text-[#1C1917]">
                  {lang === 'fa'
                    ? 'بررسی و تایید مشارکت‌های مردمی (Moderation Queue)'
                    : 'Community Submissions Moderation Queue'}
                </h2>
                <span className="text-xs text-[#254B36] font-medium">
                  {lang === 'fa'
                    ? 'با زدن دکمه «تایید (Approved)»، مورد ارسالی به صورت خودکار به لیست مکان‌های نقشه اضافه می‌شود.'
                    : 'Approving a submission automatically publishes it as a location on the public map.'}
                </span>
              </div>

              {(adminData?.contributions || []).map((c) => {
                const correspondingPlace = activePlaces.find(
                  (p) => p.slug === `contrib-place-${c.id}`
                );
                return (
                  <div
                    key={c.id}
                    className="p-5 bg-white rounded-xl border border-[#806B50]/25 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="font-bold text-base text-[#1C1917]">{c.title}</div>
                        <div className="text-xs text-[#57534E] flex items-center gap-2 mt-1 flex-wrap">
                          <span>نوع: {c.submissionType}</span>
                          <span aria-hidden="true">·</span>
                          <span>ارسال‌کننده: {c.contributorName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#806B50]">
                            اطلاعات تماس (خصوصی): {c.contactInfo}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-semibold text-[#254B36]">
                        وضعیت فعلی:{' '}
                        {c.moderationStatus === 'pending_review'
                          ? 'در انتظار بررسی (Pending review)'
                          : c.moderationStatus === 'approved'
                          ? 'تاییدشده و اضافه‌شده به نقشه (Approved)'
                          : c.moderationStatus === 'rejected'
                          ? 'ردشده (Rejected)'
                          : 'نیازمند اطلاعات بیشتر (Needs more info)'}
                      </span>
                    </div>

                    <p className="text-sm text-[#292524] leading-relaxed bg-[#F5F2E9]/60 p-3.5 rounded-lg">
                      {c.description}
                    </p>

                    {c.latitude && c.longitude && (
                      <div className="text-xs font-mono-num text-[#254B36]">
                        مختصات ثبت‌شده: {c.latitude}, {c.longitude}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {[
                          { id: 'pending_review', label: 'در انتظار بررسی (Pending)' },
                          { id: 'approved', label: '✓ تایید و افزودن به نقاط نقشه (Approve)' },
                          { id: 'needs_more_info', label: 'نیازمند اطلاعات بیشتر (Needs Info)' },
                          { id: 'rejected', label: 'رد کردن (Reject)' },
                        ].map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={async () => {
                              await authFetch(`/api/admin/contributions/${c.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ moderationStatus: st.id }),
                              });
                              setStatusMessage({
                                type: 'success',
                                text:
                                  st.id === 'approved'
                                    ? `مشارکت «${c.title}» تایید شد و به فهرست مکان‌ها و نقاط روی نقشه برزک اضافه گردید.`
                                    : `وضعیت مشارکت به «${st.label}» تغییر یافت.`,
                              });
                              await fetchAdminData();
                              await onRefreshPublic();
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              c.moderationStatus === st.id
                                ? 'bg-[#254B36] text-[#F5F2E9]'
                                : 'bg-[#EBE6DF] text-[#1C1917] hover:bg-[#D6CEBE]'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>

                      {correspondingPlace && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('places');
                            handleEditPlaceClick(correspondingPlace);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D6A83F]/25 hover:bg-[#D6A83F]/40 text-[#1C1917] text-xs font-semibold transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>ویرایش این مکان در بخش مکان‌ها</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB E: WORDPRESS ELEMENTOR EMBEDDING GUIDE */}
          {activeTab === 'embed' && (
            <div className="bg-white p-6 rounded-xl border border-[#806B50]/25 space-y-5">
              <h2 className="text-lg font-bold text-[#1C1917]">
                {lang === 'fa'
                  ? 'راهنمای جاسازی در وردپرس و المنتور (WordPress / Elementor Iframe Integration)'
                  : 'WordPress & Elementor Iframe Integration Guide'}
              </h2>
              <p className="text-sm text-[#57534E] leading-relaxed">
                {lang === 'fa'
                  ? 'حالت جاسازی (?embed=1) بدون هدر و فوتر طراحی شده و تمام عرض و ارتفاع قاب (iframe) را به صورت کاملاً واکنش‌گرا در اختیار نقشه، پنل لایه‌ها و جزئیات مکان قرار می‌دهد. برای قرار دادن نقشه در وردپرس یا المنتور، بلوک HTML را اضافه کرده و کد زیر را جایگذاری نمایید:'
                  : 'The embed mode (?embed=1) hides the website header and footer, filling 100% of the iframe container while preserving layer toggles, search, and location details.'}
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#254B36]">
                    کد آماده جهت قرار دادن در ویجت HTML المنتور (Elementor HTML Widget):
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(iframeSnippet)}
                    className="flex items-center gap-1 px-3 py-1 rounded bg-[#254B36] text-[#F5F2E9] text-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>کپی کد Iframe</span>
                  </button>
                </div>
                <pre
                  dir="ltr"
                  className="p-4 rounded-lg bg-[#1C1917] text-[#F5F2E9] text-xs font-mono-num overflow-x-auto"
                >
                  {iframeSnippet}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
