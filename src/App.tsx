import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Globe,
  Layers,
  List,
  Map as MapIcon,
  MapPin,
  PlusCircle,
  Route as RouteIcon,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { apiRequest } from './data/api';
import {
  Language,
  PlaceRecord,
  PublicMapBundle,
  RouteRecord,
  StoryRecord,
} from './types';
import { LayerIcon } from './components/LayerIcon';
import { BarzokMapCanvas } from './components/BarzokMapCanvas';
import { LocationDetailPanel } from './components/LocationDetailPanel';
import { ContributionModal } from './components/ContributionModal';
import { AdminDashboard } from './components/AdminDashboard';
import { attachHostedMedia } from './utils/hostedMedia';
import { ResultsPanel } from './components/ResultsPanel';
import { buildNeighbourhoodIndex, NEIGHBOURHOOD_LAYER_ID } from './utils/neighbourhood';
import { WalkGuide } from './components/WalkGuide';
import { useGeolocation } from './hooks/useGeolocation';
import { embedUrl as buildEmbedUrl, isAdminLocation, setQueryParam, slugFromLocation } from './utils/urls';

type PublicSection = 'map' | 'stories' | 'people' | 'about' | 'admin';

function safeParseJson<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function BarzokAppContent() {
  // `?lang=en` lets an embedding page (WordPress/Elementor) pick the language.
  const [lang, setLang] = useState<Language>(() =>
    new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'fa'
  );
  const [pathname, setPathname] = useState<string>(window.location.pathname);

  const isEmbedMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return pathname.startsWith('/embed') || params.get('embed') === '1';
  }, [pathname]);

  const [activeSection, setActiveSection] = useState<PublicSection>(() =>
    isAdminLocation() ? 'admin' : 'map'
  );

  const [bundle, setBundle] = useState<PublicMapBundle>({
    layers: [],
    places: [],
    people: [],
    stories: [],
    events: [],
    routes: [],
    placePeople: [],
    placeStories: [],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Layer visibility state (initialized dynamically from database layers)
  const [enabledLayerIds, setEnabledLayerIds] = useState<Record<string, boolean>>({});
  const [layerPanelOpen, setLayerPanelOpen] = useState<boolean>(() => window.innerWidth >= 768);
  const [mobileSheetOpen, setMobileSheetOpen] = useState<boolean>(false);

  // Search & Map/List View Toggle
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [hoodFilter, setHoodFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Selected Place, Active Walking Route & Story Modal
  const [selectedPlace, setSelectedPlace] = useState<PlaceRecord | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteRecord | null>(null);
  const [selectedStoryModal, setSelectedStoryModal] = useState<StoryRecord | null>(null);

  // Community Contribution Modal & Map Coordinate Picking
  const [contributionOpen, setContributionOpen] = useState<boolean>(false);
  const [pickingForContribution, setPickingForContribution] = useState<boolean>(false);
  const [pickedContributionCoords, setPickedContributionCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState<boolean>(false);
  const geo = useGeolocation();
  const [walkOpen, setWalkOpen] = useState<boolean>(false);
  const [walkFocusId, setWalkFocusId] = useState<string | null>(null);
  const [followUser, setFollowUser] = useState<boolean>(false);

  const setAllLayers = (on: boolean) => {
    setResultsOpen(true);
    setEnabledLayerIds(() => {
      const next: Record<string, boolean> = {};
      bundle.layers.forEach((l) => {
        next[l.id] = on;
      });
      return next;
    });
  };

  const allNoneBar = (
    <div className="flex items-center gap-2 px-1 pb-1.5 text-xs font-semibold">
      <button type="button" onClick={() => setAllLayers(true)} className="px-2.5 py-1 rounded-md bg-[#254B36] text-[#F5F2E9]">
        {lang === 'fa' ? 'روشن کردن همه' : 'Show all'}
      </button>
      <button type="button" onClick={() => setAllLayers(false)} className="px-2.5 py-1 rounded-md bg-[#EBE6DF] text-[#1C1917]">
        {lang === 'fa' ? 'خاموش کردن همه' : 'Hide all'}
      </button>
    </div>
  );

  const startRoute = (rt: RouteRecord | null) => {
    setActiveRoute(rt);
    setWalkOpen(Boolean(rt));
  };

  // Sync HTML dir and lang attributes
  useEffect(() => {
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Listen to browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
      if (isAdminLocation()) {
        setActiveSection('admin');
      } else {
        const slug = slugFromLocation();
        const found = slug ? bundle.places.find((p) => p.slug === slug) : null;
        setSelectedPlace(found ?? null);
        setActiveSection('map');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [bundle.places]);

  const fetchPublicBundle = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiRequest<PublicMapBundle>('GET', '/api/public/map-bundle');
      await attachHostedMedia(data.places);
      setBundle(data);

      // Initialize layer visibility from DB layers
      setEnabledLayerIds((prev) => {
        const next: Record<string, boolean> = {};
        for (const l of data.layers) {
          next[l.id] = prev[l.id] !== undefined ? prev[l.id] : l.isVisible;
        }
        return next;
      });

      // Open the place named in the URL (?place=slug), e.g. from a QR code or a shared link
      {
        const slug = slugFromLocation();
        const matched = slug ? data.places.find((p) => p.slug === slug) : null;
        if (matched) {
          setSelectedPlace(matched);
        }
      }
    } catch (err: any) {
      console.error('Error loading map bundle:', err);
      setLoadError(err.message || 'خطا در دریافت اطلاعات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPublicBundle();
  }, [fetchPublicBundle]);

  // Select a place and update URL to /place/:slug (unless in /embed mode)
  const handleSelectPlace = (place: PlaceRecord | null) => {
    setSelectedPlace(place);
    if (!isEmbedMode) setQueryParam('place', place ? place.slug : null);
  };

  const navigateToSection = (section: PublicSection) => {
    setActiveSection(section);
    setQueryParam('place', null);
    setQueryParam('admin', section === 'admin' ? '1' : null, true);
    setPathname(window.location.pathname);
  };

  // Filter places by enabled thematic layers AND search query (including matching people & stories)
  const hoodByPlace = useMemo(() => buildNeighbourhoodIndex(bundle.places), [bundle.places]);
  const hoodList = useMemo(() => bundle.places.filter((p) => p.layerId === NEIGHBOURHOOD_LAYER_ID), [bundle.places]);

  const filteredPlaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // Find place IDs linked to matching people or stories when searching
    const matchedPlaceIdsFromPeopleOrStories: Record<string, boolean> = {};
    if (q) {
      const matchingPersonIds = bundle.people
        .filter(
          (pe) =>
            pe.nameFa.toLowerCase().includes(q) ||
            (pe.nameEn && pe.nameEn.toLowerCase().includes(q)) ||
            pe.occupationFa.toLowerCase().includes(q)
        )
        .map((pe) => pe.id);

      const matchingStoryIds = bundle.stories
        .filter(
          (st) =>
            st.titleFa.toLowerCase().includes(q) ||
            (st.titleEn && st.titleEn.toLowerCase().includes(q)) ||
            st.summaryFa.toLowerCase().includes(q)
        )
        .map((st) => st.id);

      for (const pp of bundle.placePeople) {
        if (matchingPersonIds.includes(pp.personId)) {
          matchedPlaceIdsFromPeopleOrStories[pp.placeId] = true;
        }
      }
      for (const ps of bundle.placeStories) {
        if (matchingStoryIds.includes(ps.storyId)) {
          matchedPlaceIdsFromPeopleOrStories[ps.placeId] = true;
        }
      }
    }

    return bundle.places.filter((place) => {
      const extraIds = safeParseJson<string[]>(place.additionalLayerIds, []);
      const primaryActive = place.layerId ? enabledLayerIds[place.layerId] : true;
      const secondaryActive = extraIds.some((id) => enabledLayerIds[id]);

      if (!primaryActive && !secondaryActive) {
        return false;
      }

      if (hoodFilter && hoodByPlace[place.id]?.id !== hoodFilter) return false;

      if (!q) return true;

      const matchesText =
        place.nameFa.toLowerCase().includes(q) ||
        (place.nameEn && place.nameEn.toLowerCase().includes(q)) ||
        place.category.toLowerCase().includes(q) ||
        (hoodByPlace[place.id]?.nameFa ?? '').toLowerCase().includes(q) ||
        place.shortIntroFa.toLowerCase().includes(q) ||
        place.fullDescriptionFa.toLowerCase().includes(q) ||
        Boolean(matchedPlaceIdsFromPeopleOrStories[place.id]);

      return matchesText;
    });
  }, [
    bundle.places,
    bundle.people,
    bundle.stories,
    bundle.placePeople,
    bundle.placeStories,
    enabledLayerIds,
    searchQuery,
    hoodFilter,
    hoodByPlace,
  ]);

  const hasDemoRecords = useMemo(
    () => bundle.places.some((p) => p.isDemo || p.verificationStatus === 'demo'),
    [bundle.places]
  );

  const walkGuide =
    activeRoute && walkOpen ? (
      <WalkGuide
        lang={lang}
        route={activeRoute}
        allPlaces={bundle.places}
        position={geo.position}
        geoStatus={geo.status}
        onStartGps={geo.start}
        onFocusPlace={(p) => setWalkFocusId(p.id)}
        onOpenDetails={(p) => handleSelectPlace(p)}
        followUser={followUser}
        onFollowChange={setFollowUser}
        onClose={() => {
          setWalkFocusId(null);
          setFollowUser(false);
          setWalkOpen(false);
          setActiveRoute(null);
        }}
      />
    ) : null;

  // Admin route view
  if (activeSection === 'admin' && !isEmbedMode) {
    return (
      <AdminDashboard
        lang={lang}
        publicBundle={bundle}
        onRefreshPublic={fetchPublicBundle}
        onExitAdmin={() => navigateToSection('map')}
      />
    );
  }

  const resultsPanel = (
    <ResultsPanel
      lang={lang}
      places={filteredPlaces}
      layers={bundle.layers}
      hoodByPlace={hoodByPlace}
      selectedId={selectedPlace?.id || null}
      open={resultsOpen}
      onOpenChange={setResultsOpen}
      onSelect={(p) => handleSelectPlace(p)}
    />
  );

  // WordPress / Elementor Embed View (/embed) — Full-viewport map with zero header/footer
  if (isEmbedMode) {
    return (
      <div className="w-screen h-screen overflow-hidden flex flex-col bg-[#F5F2E9]">
        <div className="relative flex-1 flex overflow-hidden">
          {/* Floating Layer & Search Overlay inside Embed View */}
          <div className="absolute top-3 right-3 z-20 w-72 max-w-[calc(100vw-24px)] bg-[#F5F2E9]/95 backdrop-blur-sm border border-[#806B50]/30 rounded-xl shadow-md overflow-hidden">
            <div className="p-2.5 border-b border-[#806B50]/20 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#806B50] absolute top-1/2 -translate-y-1/2 start-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim()) setResultsOpen(true);
                  }}
                  placeholder={lang === 'fa' ? 'جستجو در نقشه برزک...' : 'Search Barzok map...'}
                  className="w-full ps-8 pe-2.5 py-1.5 rounded-lg bg-white border border-[#806B50]/25 text-xs focus:outline-none focus:border-[#254B36]"
                />
              </div>
              <button
                type="button"
                onClick={() => setLayerPanelOpen((prev) => !prev)}
                className="p-1.5 rounded-lg bg-[#EBE6DF] text-[#254B36] hover:bg-[#D6CEBE]"
                title={lang === 'fa' ? 'لایه‌های نقشه' : 'Map Layers'}
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>

            {layerPanelOpen && (
              <div className="p-2.5 max-h-60 overflow-y-auto space-y-1">
                {allNoneBar}
                {bundle.layers.map((layer) => {
                  const checked = Boolean(enabledLayerIds[layer.id]);
                  return (
                    <label
                      key={layer.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#EBE6DF]/70 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setResultsOpen(true);
                            setEnabledLayerIds((prev) => ({
                              ...prev,
                              [layer.id]: !prev[layer.id],
                            }));
                          }}
                          className="accent-[#254B36]"
                        />
                        <span
                          style={{ backgroundColor: layer.color }}
                          className="w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0"
                        >
                          <LayerIcon name={layer.icon} className="w-3 h-3" />
                        </span>
                        <span className="truncate font-medium text-[#1C1917]">
                          {lang === 'fa' ? layer.nameFa : layer.nameEn || layer.nameFa}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            {bundle.routes.length > 0 && (
              <div className="p-2.5 border-t border-[#806B50]/20 space-y-1">
                {bundle.routes.map((rt) => (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => startRoute(activeRoute?.id === rt.id ? null : rt)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#254B36] text-[#F5F2E9] text-xs font-semibold"
                  >
                    <RouteIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {lang === 'fa' ? 'شروع پیاده‌روی: ' : 'Start walk: '}
                      {lang === 'fa' ? rt.titleFa : rt.titleEn || rt.titleFa}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 h-full relative">
            <BarzokMapCanvas
              lang={lang}
              layers={bundle.layers}
              places={filteredPlaces}
              allPlaces={bundle.places}
              activeRoute={activeRoute}
              selectedPlaceId={selectedPlace?.id || walkFocusId}
              onSelectPlace={handleSelectPlace}
              userPosition={geo.position}
              onLocateMe={geo.start}
                  followUser={followUser}
                  onFollowChange={setFollowUser}
            />
            {resultsPanel}
            {walkGuide}
          </div>

          {selectedPlace && (
            <LocationDetailPanel
              lang={lang}
              place={selectedPlace}
              layers={bundle.layers}
              allPlaces={bundle.places}
              people={bundle.people}
              stories={bundle.stories}
              events={bundle.events}
              placePeople={bundle.placePeople}
              placeStories={bundle.placeStories}
              neighbourhood={hoodByPlace[selectedPlace.id] ?? null}
              onClose={() => handleSelectPlace(null)}
              onSelectPlace={handleSelectPlace}
              onSelectStory={(st) => setSelectedStoryModal(st)}
            />
          )}
        </div>
      </div>
    );
  }

  // `?embed=1` works on any static host (no server rewrite needed, unlike `/embed`).
  const embedUrl = buildEmbedUrl();
  const iframeSnippet = `<iframe src="${embedUrl}" width="100%" height="680" style="border:0; border-radius: 12px; overflow: hidden;" allow="geolocation" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="مردمنگار برزک | Barzok People Map"></iframe>`;

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F2E9] text-[#1C1917]">
      {/* Strict 3-Zone Top Bar Contract (frontend-design §2) */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-[#F5F2E9] border-b border-[#806B50]/25 shrink-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="?"
          onClick={(e) => {
            e.preventDefault();
            navigateToSection('map');
          }}
          className="text-xl font-bold tracking-tight text-[#254B36] whitespace-nowrap shrink-0"
        >
          {lang === 'fa' ? 'مردمنگار برزک' : 'Barzok People Map'}
        </a>

        {/* Zone 2: 4–5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534E]">
          <button
            type="button"
            onClick={() => navigateToSection('map')}
            className={`hover:text-[#254B36] transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'map'
                ? 'text-[#254B36] font-semibold underline underline-offset-8 decoration-[#D6A83F] decoration-2'
                : ''
            }`}
          >
            {lang === 'fa' ? 'نقشه' : 'Map'}
          </button>
          <button
            type="button"
            onClick={() => navigateToSection('stories')}
            className={`hover:text-[#254B36] transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'stories'
                ? 'text-[#254B36] font-semibold underline underline-offset-8 decoration-[#D6A83F] decoration-2'
                : ''
            }`}
          >
            {lang === 'fa' ? 'داستان‌ها' : 'Stories'}
          </button>
          <button
            type="button"
            onClick={() => navigateToSection('people')}
            className={`hover:text-[#254B36] transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'people'
                ? 'text-[#254B36] font-semibold underline underline-offset-8 decoration-[#D6A83F] decoration-2'
                : ''
            }`}
          >
            {lang === 'fa' ? 'مردم و مشاغل' : 'People & Crafts'}
          </button>
          <button
            type="button"
            onClick={() => navigateToSection('about')}
            className={`hover:text-[#254B36] transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'about'
                ? 'text-[#254B36] font-semibold underline underline-offset-8 decoration-[#D6A83F] decoration-2'
                : ''
            }`}
          >
            {lang === 'fa' ? 'درباره پروژه' : 'About Project'}
          </button>
          <button
            type="button"
            onClick={() => setLang((prev) => (prev === 'fa' ? 'en' : 'fa'))}
            className="hover:text-[#254B36] transition-colors whitespace-nowrap shrink-0 text-xs font-mono-num"
          >
            {lang === 'fa' ? 'EN / فارسی' : 'فارسی / EN'}
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setContributionOpen(true)}
            className="px-4 py-2 text-xs font-medium text-[#F5F2E9] bg-[#254B36] rounded-lg hover:bg-[#1d3b2a] transition-colors whitespace-nowrap shrink-0"
          >
            {lang === 'fa' ? 'ثبت مشارکت مردمی' : 'Contribute Memory'}
          </button>
        </div>
      </header>

      {/* Subtitle & Workspace Control Strip below the fold/header */}
      <div className="px-4 py-1.5 bg-[#EBE6DF]/80 border-b border-[#806B50]/20 flex items-center justify-between gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-3 text-[#57534E]">
          <span className="font-medium text-[#1C1917]">
            {lang === 'fa'
              ? 'نقشه زنده حافظه، فرهنگ و زندگی مردم برزک'
              : 'Living Map of Memory, Culture, and Everyday Life in Barzok'}
          </span>
          {hasDemoRecords && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#806B50] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D6A83F]" />
                {lang === 'fa'
                  ? 'حالت نمایشی (شامل رکوردهای نمونه آزمایشی — قابل مدیریت در پنل مدیر)'
                  : 'Demo Mode Active (Sample records clearly labeled — manageable in /admin)'}
              </span>
            </>
          )}
        </div>

        {/* Mobile Nav + Discreet Admin Link */}
        <div className="flex items-center gap-4">
          <div className="flex md:hidden items-center gap-3 text-xs font-medium">
            <button type="button" onClick={() => navigateToSection('map')}>
              {lang === 'fa' ? 'نقشه' : 'Map'}
            </button>
            <button type="button" onClick={() => navigateToSection('stories')}>
              {lang === 'fa' ? 'داستان‌ها' : 'Stories'}
            </button>
            <button type="button" onClick={() => navigateToSection('about')}>
              {lang === 'fa' ? 'درباره' : 'About'}
            </button>
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'fa' ? 'en' : 'fa'))}
            >
              {lang === 'fa' ? 'EN' : 'فا'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigateToSection('admin')}
            className="text-xs text-[#806B50] hover:text-[#254B36] transition-colors whitespace-nowrap"
          >
            {lang === 'fa' ? 'ورود مدیران (/admin)' : 'Admin Login (/admin)'}
          </button>
        </div>
      </div>

      {/* Coordinate Picking Banner when user is selecting a point for Community Contribution */}
      {pickingForContribution && (
        <div className="px-6 py-2.5 bg-[#D6A83F] text-[#1C1917] text-xs font-semibold flex items-center justify-between">
          <span>
            {lang === 'fa'
              ? 'روی نقطه مورد نظر خود در نقشه برزک کلیک کنید تا مختصات آن در فرم مشارکت ثبت شود.'
              : 'Click anywhere on the Barzok map to select coordinates for your contribution.'}
          </span>
          <button
            type="button"
            onClick={() => {
              setPickingForContribution(false);
              setContributionOpen(true);
            }}
            className="px-3 py-1 rounded bg-[#1C1917] text-[#F5F2E9] text-xs"
          >
            {lang === 'fa' ? 'بازگشت به فرم مشارکت' : 'Back to Form'}
          </button>
        </div>
      )}

      {/* SECTION 1: INTERACTIVE MAP & LIST INTERFACE */}
      {activeSection === 'map' && (
        <main className="flex-1 flex flex-col md:flex-row relative overflow-hidden min-h-[calc(100dvh-100px)]">
          {/* Collapsible Layer & Search Sidebar (Desktop) */}
          <div
            className={`hidden md:flex flex-col bg-[#F5F2E9] border-e border-[#806B50]/25 transition-all duration-200 z-20 shrink-0 ${
              layerPanelOpen ? 'w-72' : 'w-12'
            }`}
          >
            <div className="p-3.5 border-b border-[#806B50]/20 flex items-center justify-between">
              {layerPanelOpen && (
                <span className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#254B36]" />
                  <span>{lang === 'fa' ? 'لایه‌های موضوعی و فیلتر' : 'Thematic Layers'}</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => setLayerPanelOpen((prev) => !prev)}
                className="p-2 rounded-lg bg-[#EBE6DF] hover:bg-[#D6CEBE] text-[#1C1917] mx-auto"
                title={lang === 'fa' ? 'باز / بسته کردن پنل لایه‌ها' : 'Toggle Layer Panel'}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {layerPanelOpen && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Search Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#57534E]">
                    {lang === 'fa'
                      ? 'جستجوی مکان، پیشه، شخص یا داستان'
                      : 'Search Places, People & Stories'}
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#806B50] absolute top-1/2 -translate-y-1/2 start-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (e.target.value.trim()) setResultsOpen(true);
                      }}
                      placeholder={
                        lang === 'fa'
                          ? 'جستجو در برزک...'
                          : 'Search Barzok heritage...'
                      }
                      className="w-full ps-9 pe-8 py-2 rounded-lg bg-white border border-[#806B50]/30 text-xs text-[#1C1917] focus:outline-none focus:border-[#254B36]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute top-1/2 -translate-y-1/2 end-2.5 text-[#806B50] hover:text-[#1C1917]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {hoodList.length > 0 && (
                    <select
                      value={hoodFilter}
                      onChange={(e) => {
                        setHoodFilter(e.target.value);
                        setResultsOpen(true);
                      }}
                      aria-label={lang === 'fa' ? 'فیلتر محله' : 'Neighbourhood filter'}
                      className="mt-2 w-full px-2.5 py-2 rounded-lg bg-white border border-[#806B50]/30 text-xs text-[#1C1917]"
                    >
                      <option value="">{lang === 'fa' ? 'همه‌ی محله‌ها' : 'All neighbourhoods'}</option>
                      {hoodList.map((h) => (
                        <option key={h.id} value={h.id}>
                          {lang === 'fa' ? h.nameFa : h.nameEn || h.nameFa}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Map / List View Segmented Control */}
                <div className="flex items-center gap-1 p-1 bg-[#EBE6DF] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      viewMode === 'map'
                        ? 'bg-[#254B36] text-[#F5F2E9] shadow-sm'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>{lang === 'fa' ? 'نمای نقشه' : 'Map View'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      viewMode === 'list'
                        ? 'bg-[#254B36] text-[#F5F2E9] shadow-sm'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'fa'
                        ? `نمای فهرست (${filteredPlaces.length})`
                        : `List View (${filteredPlaces.length})`}
                    </span>
                  </button>
                </div>

                {/* Dynamic Thematic Layers from Database */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#57534E]">
                      {lang === 'fa' ? 'لایه‌های نقشه' : 'Map Layers'}
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setAllLayers(true)}
                        className="px-2 py-0.5 rounded bg-[#254B36] text-[#F5F2E9] font-semibold"
                      >
                        {lang === 'fa' ? 'روشن کردن همه' : 'Show all'}
                      </button>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setAllLayers(false)}
                        className="px-2 py-0.5 rounded bg-[#EBE6DF] text-[#1C1917] font-semibold"
                      >
                        {lang === 'fa' ? 'خاموش کردن همه' : 'Hide all'}
                      </button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="text-xs text-[#806B50] py-4">
                      {lang === 'fa' ? 'در حال بارگذاری لایه‌ها...' : 'Loading layers...'}
                    </div>
                  ) : bundle.layers.length === 0 ? (
                    <div className="text-xs text-[#806B50] py-4">
                      {lang === 'fa'
                        ? 'هنوز لایه‌ای ثبت نشده است. از پنل مدیریت (/admin) اولین لایه را بسازید.'
                        : 'No layers configured yet. Use /admin to create layers.'}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {bundle.layers.map((layer) => {
                        const checked = Boolean(enabledLayerIds[layer.id]);
                        const count = bundle.places.filter((p) => {
                          const extras = safeParseJson<string[]>(p.additionalLayerIds, []);
                          return p.layerId === layer.id || extras.includes(layer.id);
                        }).length;

                        return (
                          <label
                            key={layer.id}
                            className={`flex items-start justify-between gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                              checked
                                ? 'bg-white border-[#806B50]/30'
                                : 'bg-[#EBE6DF]/40 border-transparent opacity-70'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setResultsOpen(true);
                                  setEnabledLayerIds((prev) => ({
                                    ...prev,
                                    [layer.id]: !prev[layer.id],
                                  }));
                                }}
                                className="mt-1 accent-[#254B36]"
                              />
                              <div
                                style={{ backgroundColor: layer.color }}
                                className="w-7 h-7 rounded-full text-[#F5F2E9] flex items-center justify-center shrink-0 mt-0.5"
                              >
                                <LayerIcon name={layer.icon} className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[#1C1917] truncate">
                                  {lang === 'fa' ? layer.nameFa : layer.nameEn || layer.nameFa}
                                </div>
                                {layer.descriptionFa && (
                                  <div className="text-[11px] text-[#57534E] line-clamp-1 mt-0.5">
                                    {lang === 'fa'
                                      ? layer.descriptionFa
                                      : layer.descriptionEn || layer.descriptionFa}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-mono-num text-[#806B50] shrink-0">
                              {count}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Storytelling Walking Routes Selector */}
                {bundle.routes.length > 0 && (
                  <div className="space-y-2 border-t border-[#806B50]/20 pt-4">
                    <span className="text-xs font-semibold text-[#57534E] flex items-center gap-1.5">
                      <RouteIcon className="w-3.5 h-3.5 text-[#D6A83F]" />
                      <span>
                        {lang === 'fa' ? 'مسیرهای داستانی و پیاده‌روی' : 'Storytelling Routes'}
                      </span>
                    </span>
                    <div className="space-y-1.5">
                      {bundle.routes.map((rt) => {
                        const isActive = activeRoute?.id === rt.id;
                        return (
                          <button
                            key={rt.id}
                            type="button"
                            onClick={() => startRoute(isActive ? null : rt)}
                            className={`w-full text-start p-2.5 rounded-lg border text-xs transition-colors ${
                              isActive
                                ? 'bg-[#254B36] text-[#F5F2E9] border-[#254B36]'
                                : 'bg-white text-[#1C1917] border-[#806B50]/25 hover:bg-[#EBE6DF]'
                            }`}
                          >
                            <div className="font-semibold">
                              {lang === 'fa' ? rt.titleFa : rt.titleEn || rt.titleFa}
                            </div>
                            <div
                              className={`text-[11px] font-mono-num mt-0.5 ${
                                isActive ? 'text-[#F5F2E9]/80' : 'text-[#806B50]'
                              }`}
                            >
                              {rt.distanceKm} km · {rt.durationMinutes} min ·{' '}
                              {rt.stops?.length || 0}{' '}
                              {lang === 'fa' ? 'ایستگاه' : 'stops'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center Map or List Canvas */}
          <div className="flex-1 relative flex flex-col min-h-[520px]">
            {loadError && (
              <div className="p-3 bg-red-50 border-b border-red-200 text-red-800 text-xs text-center">
                {loadError}
              </div>
            )}

            {viewMode === 'map' ? (
              <div className="flex-1 w-full h-full relative">
                <BarzokMapCanvas
                  lang={lang}
                  layers={bundle.layers}
                  places={filteredPlaces}
                  allPlaces={bundle.places}
                  activeRoute={activeRoute}
                  selectedPlaceId={selectedPlace?.id || walkFocusId}
                  onSelectPlace={(p) => handleSelectPlace(p)}
                  userPosition={geo.position}
                  onLocateMe={geo.start}
                  followUser={followUser}
                  onFollowChange={setFollowUser}
                  pickMode={pickingForContribution}
                  pickedCoords={pickedContributionCoords}
                  onPickCoords={(coords) => {
                    setPickedContributionCoords(coords);
                    setPickingForContribution(false);
                    setContributionOpen(true);
                  }}
                />
                {resultsPanel}
                {walkGuide}
              </div>
            ) : (
              /* List View of Filtered Places */
              <div className="flex-1 overflow-y-auto p-6 bg-[#F5F2E9]">
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="flex items-center justify-between border-b border-[#806B50]/20 pb-3">
                    <h2 className="text-lg font-bold text-[#1C1917]">
                      {lang === 'fa'
                        ? `فهرست مکان‌های برزک (${filteredPlaces.length})`
                        : `Barzok Locations Directory (${filteredPlaces.length})`}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setViewMode('map')}
                      className="text-xs font-medium text-[#254B36] hover:underline"
                    >
                      {lang === 'fa' ? 'بازگشت به نقشه ←' : 'Back to Map →'}
                    </button>
                  </div>

                  {filteredPlaces.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-xl border border-[#806B50]/20 text-sm text-[#57534E]">
                      {lang === 'fa'
                        ? 'مکانی با فیلترهای انتخابی یافت نشد.'
                        : 'No locations match the current layer filters or search query.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredPlaces.map((place) => {
                        const layer = bundle.layers.find((l) => l.id === place.layerId);
                        return (
                          <button
                            key={place.id}
                            type="button"
                            onClick={() => handleSelectPlace(place)}
                            className="text-start p-5 rounded-xl bg-white border border-[#806B50]/25 hover:border-[#254B36] transition-colors space-y-2 shadow-xs"
                          >
                            <div className="flex items-center gap-2 text-xs text-[#806B50]">
                              <span className="font-semibold text-[#254B36]">
                                {layer
                                  ? lang === 'fa'
                                    ? layer.nameFa
                                    : layer.nameEn || layer.nameFa
                                  : place.category}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num">
                                {place.latitude.toFixed(4)}°N, {place.longitude.toFixed(4)}°E
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-[#1C1917]">
                              {lang === 'fa' ? place.nameFa : place.nameEn || place.nameFa}
                            </h3>
                            <p className="text-xs text-[#57534E] line-clamp-2 leading-relaxed">
                              {lang === 'fa'
                                ? place.shortIntroFa
                                : place.shortIntroEn || place.shortIntroFa}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mobile Bottom Sheet Trigger Bar (Respects 15% mobile sticky cap) */}
            <div className="md:hidden bg-[#F5F2E9] border-t border-[#806B50]/30 px-4 py-2.5 flex items-center justify-between z-30">
              <button
                type="button"
                onClick={() => setMobileSheetOpen((prev) => !prev)}
                className="flex items-center gap-2 text-xs font-semibold text-[#254B36]"
              >
                <Layers className="w-4 h-4" />
                <span>
                  {lang === 'fa'
                    ? `لایه‌ها و جستجو (${filteredPlaces.length})`
                    : `Layers & Search (${filteredPlaces.length})`}
                </span>
                {mobileSheetOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode((v) => (v === 'map' ? 'list' : 'map'))}
                  className="px-3 py-1 rounded bg-[#EBE6DF] text-xs font-medium text-[#1C1917]"
                >
                  {viewMode === 'map'
                    ? lang === 'fa'
                      ? 'نمای فهرست'
                      : 'List'
                    : lang === 'fa'
                    ? 'نمای نقشه'
                    : 'Map'}
                </button>
              </div>
            </div>

            {/* Mobile Collapsible Bottom Sheet for Layers */}
            {mobileSheetOpen && (
              <div className="md:hidden absolute inset-x-0 bottom-11 z-30 bg-[#F5F2E9] border-t border-[#806B50]/30 max-h-[55vh] overflow-y-auto p-4 space-y-3 shadow-2xl">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim()) setResultsOpen(true);
                  }}
                  placeholder={lang === 'fa' ? 'جستجو در نقشه...' : 'Search...'}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#806B50]/30 text-xs"
                />
                {allNoneBar}
                <div className="grid grid-cols-2 gap-2">
                  {bundle.layers.map((layer) => {
                    const checked = Boolean(enabledLayerIds[layer.id]);
                    return (
                      <label
                        key={layer.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white border border-[#806B50]/20 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setResultsOpen(true);
                            setEnabledLayerIds((prev) => ({
                              ...prev,
                              [layer.id]: !prev[layer.id],
                            }));
                          }}
                          className="accent-[#254B36]"
                        />
                        <span className="truncate">
                          {lang === 'fa' ? layer.nameFa : layer.nameEn || layer.nameFa}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Location Detail Panel (Right Drawer on Desktop / Full Sheet on Mobile) */}
          {selectedPlace && (
            <LocationDetailPanel
              lang={lang}
              place={selectedPlace}
              layers={bundle.layers}
              allPlaces={bundle.places}
              people={bundle.people}
              stories={bundle.stories}
              events={bundle.events}
              placePeople={bundle.placePeople}
              placeStories={bundle.placeStories}
              neighbourhood={hoodByPlace[selectedPlace.id] ?? null}
              onClose={() => handleSelectPlace(null)}
              onSelectPlace={(p) => handleSelectPlace(p)}
              onSelectStory={(st) => setSelectedStoryModal(st)}
            />
          )}
        </main>
      )}

      {/* SECTION 2: STORIES & ORAL HISTORIES ARCHIVE */}
      {activeSection === 'stories' && (
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-8">
          <div className="border-b border-[#806B50]/25 pb-5 space-y-2">
            <div className="text-xs tracking-widest uppercase text-[#806B50]">
              {lang === 'fa' ? 'تاریخ شفاهی و روایت‌های برزک' : 'ORAL HISTORIES & ARCHIVAL NARRATIVES'}
            </div>
            <h1 className="text-3xl font-bold text-[#1C1917]">
              {lang === 'fa' ? 'داستان‌ها، خاطرات و روایت‌های مردم برزک' : 'Stories & Memories of Barzok'}
            </h1>
            <p className="text-sm text-[#57534E] max-w-2xl leading-relaxed">
              {lang === 'fa'
                ? 'هر روایت در «مردمنگار برزک» به مکان‌های جغرافیایی و چهره‌های محلی متصل است تا بازدیدکنندگان بتوانند حافظه زیسته شهر را در بستر مکان تجربه کنند.'
                : 'Every narrative in Barzok People Map is linked to its geographic locations and local people.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bundle.stories.map((st) => {
              const linkedPlaces = bundle.placeStories
                .filter((ps) => ps.storyId === st.id)
                .map((ps) => bundle.places.find((p) => p.id === ps.placeId))
                .filter(Boolean) as PlaceRecord[];

              return (
                <article
                  key={st.id}
                  className="bg-white rounded-xl border border-[#806B50]/25 overflow-hidden flex flex-col justify-between"
                >
                  {st.imageUrl && (
                    <img
                      src={st.imageUrl}
                      alt={st.titleFa}
                      referrerPolicy="no-referrer"
                      className="w-full h-52 object-cover"
                    />
                  )}
                  <div className="p-6 space-y-3 flex-1">
                    <div className="flex items-center gap-2 text-xs text-[#806B50]">
                      <span>{st.narratorName || 'راوی محلی'}</span>
                      {st.recordedDate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{st.recordedDate}</span>
                        </>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-[#1C1917]">
                      {lang === 'fa' ? st.titleFa : st.titleEn || st.titleFa}
                    </h2>
                    <p className="text-xs text-[#57534E] leading-relaxed">{st.contentFa}</p>
                  </div>

                  {linkedPlaces.length > 0 && (
                    <div className="px-6 py-3.5 bg-[#EBE6DF]/60 border-t border-[#806B50]/20 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs text-[#57534E]">
                        {lang === 'fa' ? 'مکان‌های مرتبط روی نقشه:' : 'Linked Locations:'}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {linkedPlaces.map((lp) => (
                          <button
                            key={lp.id}
                            type="button"
                            onClick={() => {
                              handleSelectPlace(lp);
                              navigateToSection('map');
                            }}
                            className="text-xs font-semibold text-[#254B36] hover:underline flex items-center gap-1"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{lang === 'fa' ? lp.nameFa : lp.nameEn || lp.nameFa}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </main>
      )}

      {/* SECTION 3: PEOPLE & LOCAL OCCUPATIONS */}
      {activeSection === 'people' && (
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-8">
          <div className="border-b border-[#806B50]/25 pb-5 space-y-2">
            <div className="text-xs tracking-widest uppercase text-[#806B50]">
              {lang === 'fa' ? 'مردم‌نگاری مشاغل و پیشه‌وران' : 'LOCAL PEOPLE & TRADITIONAL CRAFTS'}
            </div>
            <h1 className="text-3xl font-bold text-[#1C1917]">
              {lang === 'fa' ? 'مردم، استادکاران و مشاغل بومی برزک' : 'People & Traditional Occupations'}
            </h1>
            <p className="text-sm text-[#57534E] max-w-2xl leading-relaxed">
              {lang === 'fa'
                ? 'مستندسازی دانش بومی، هنرهای دستی، باغداری سنتی و پیشه‌وران برزک در پیوند با کارگاه‌ها و مکان‌های تاریخی.'
                : 'Documenting indigenous craft knowledge, handloom weaving, orchard stewardship, and artisans of Barzok.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bundle.people.map((person) => (
              <div
                key={person.id}
                className="p-6 bg-white rounded-xl border border-[#806B50]/25 space-y-3"
              >
                <div className="flex items-center gap-4">
                  {person.avatarUrl ? (
                    <img
                      src={person.avatarUrl}
                      alt={person.nameFa}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full object-cover border border-[#806B50]/30 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#254B36] text-[#F5F2E9] flex items-center justify-center shrink-0">
                      <Users className="w-7 h-7" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-base font-bold text-[#1C1917]">
                      {lang === 'fa' ? person.nameFa : person.nameEn || person.nameFa}
                    </h2>
                    <div className="text-xs text-[#254B36] font-medium mt-0.5">
                      {lang === 'fa'
                        ? person.occupationFa
                        : person.occupationEn || person.occupationFa}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[#57534E] leading-relaxed">
                  {lang === 'fa' ? person.bioFa : person.bioEn || person.bioFa}
                </p>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* SECTION 4: ABOUT PROJECT, WORDPRESS EMBEDDING & ARCHITECTURE */}
      {activeSection === 'about' && (
        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-10">
          <section className="space-y-4 border-b border-[#806B50]/25 pb-8">
            <div className="text-xs tracking-widest uppercase text-[#806B50]">
              {lang === 'fa'
                ? 'درباره سامانه مردمنگار برزک'
                : 'DIGITAL ETHNOGRAPHY & CULTURAL HERITAGE PLATFORM'}
            </div>
            <h1 className="text-3xl font-bold text-[#1C1917]">
              {lang === 'fa'
                ? 'مردمنگار برزک: نقشه زنده حافظه، فرهنگ و زندگی مردم برزک'
                : 'Barzok People Map: Living Cultural & Ethnographic Atlas'}
            </h1>
            <p className="text-sm text-[#292524] leading-loose max-w-prose">
              {lang === 'fa'
                ? '«مردمنگار برزک» یک پلتفرم دیجیتال مردم‌نگاری و نقشه‌برداری میراث فرهنگی برای شهر تاریخی برزک (در شهرستان کاشان، استان اصفهان) است. هدف این سامانه حفاظت از میراث ملموس و ناملموس برزک، ثبت روایت‌های شفاهی، معرفی مشاغل سنتی، کمک به گردشگران فرهنگی برای کشف آگاهانه برزک و جلب مشارکت مستقیم جامعه محلی در مستندسازی تاریخ و زندگی روزمره است.'
                : 'Barzok People Map is a digital ethnographic and cultural heritage mapping platform for Barzok, a historic mountain oasis town near Kashan, Isfahan, Iran. It preserves local architecture, oral histories, occupations, and traditions while enabling community participation.'}
            </p>
          </section>

          {/* WordPress & Elementor Iframe Embedding Guide */}
          <section className="bg-white p-6 rounded-xl border border-[#806B50]/25 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-bold text-[#254B36] flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                <span>
                  {lang === 'fa'
                    ? 'راهنمای جاسازی در وردپرس و المنتور (WordPress / Elementor Embed Mode)'
                    : 'WordPress & Elementor Iframe Embedding Guide'}
                </span>
              </h2>
              <a
                href="?embed=1"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#254B36] underline"
              >
                {lang === 'fa' ? 'مشاهده زنده نمای /embed ↗' : 'Open /embed Live View ↗'}
              </a>
            </div>

            <p className="text-xs text-[#57534E] leading-relaxed">
              {lang === 'fa'
                ? 'برای قرار دادن نقشه تعاملی برزک در هر برگه وردپرس یا صفحه‌ساز المنتور (Elementor)، یک ویجت HTML اضافه کرده و کد زیر را در آن قرار دهید. برای نسخه‌ی انگلیسی به انتهای آدرس «&lang=en» اضافه کنید. پس از انتشار روی میزبان نهایی، اطمینان حاصل کنید که میزبان سرآیند frame-ancestors را مسدود نمی‌کند (راهنما در README).'
                : 'Add an HTML widget in WordPress / Elementor and paste the snippet below. Append "&lang=en" to the URL for the English UI. The embed mode hides the site header/footer and fills 100% of the iframe. After deploying, make sure your host does not block framing (see README).'}
            </p>

            <div className="relative">
              <pre
                dir="ltr"
                className="p-4 rounded-lg bg-[#1C1917] text-[#F5F2E9] text-xs font-mono-num overflow-x-auto"
              >
                {iframeSnippet}
              </pre>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(iframeSnippet);
                  setCopiedEmbed(true);
                  setTimeout(() => setCopiedEmbed(false), 2000);
                }}
                className="absolute top-2.5 right-2.5 px-3 py-1 rounded bg-[#D6A83F] text-[#1C1917] text-xs font-semibold flex items-center gap-1"
              >
                {copiedEmbed ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEmbed ? 'Copied' : 'Copy Iframe'}</span>
              </button>
            </div>
          </section>

          {/* Security, RLS & Production API Key Documentation (Section 6 & 10) */}
          <section className="bg-white p-6 rounded-xl border border-[#806B50]/25 space-y-4">
            <h2 className="text-base font-bold text-[#1C1917]">
              {lang === 'fa'
                ? 'حالت نمونه‌ی اولیه: بدون کلید API، بدون هزینه و بدون سرور'
                : 'Prototype Mode: No API Keys, No Billing, No Server'}
            </h2>
            <ul className="space-y-2 text-xs text-[#57534E] leading-relaxed list-disc ps-5">
              <li>
                <strong>نقشه:</strong> Leaflet با تایل‌های OpenStreetMap (و لایه‌ی توپوگرافی OpenTopoMap). نیازی به کلید یا حساب پرداخت نیست؛ درج منبع نقشه در گوشه‌ی نقشه الزامی است و باید حفظ شود.
              </li>
              <li>
                <strong>داده‌ها:</strong> فایل‌های JSON محلی در <code className="font-mono-num">src/data/seed</code> به‌عنوان داده‌ی اولیه، و ذخیره‌ی تغییرات در <code className="font-mono-num">localStorage</code> مرورگر. ویرایش‌ها فقط در همین مرورگر دیده می‌شوند و بین بازدیدکنندگان به اشتراک گذاشته نمی‌شوند.
              </li>
              <li>
                <strong>ورود مدیر:</strong> ورود نمایشی بدون احراز هویت واقعی است. پیش از انتشار عمومی با داده‌ی واقعی، باید پایگاه داده و احراز هویت (مثلاً Supabase) جایگزین شود؛ لایه‌ی داده (<code className="font-mono-num">src/data/api.ts</code>) و نقشه (<code className="font-mono-num">BarzokMapCanvas</code>) برای همین جایگزینی ماژولار نوشته شده‌اند.
              </li>
            </ul>
          </section>
        </main>
      )}

      {/* Story Reader Modal */}
      {selectedStoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#F5F2E9] border border-[#806B50]/30 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#254B36] text-[#F5F2E9]">
              <h3 className="text-base font-bold">{selectedStoryModal.titleFa}</h3>
              <button
                type="button"
                onClick={() => setSelectedStoryModal(null)}
                className="p-1 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {selectedStoryModal.imageUrl && (
                <img
                  src={selectedStoryModal.imageUrl}
                  alt={selectedStoryModal.titleFa}
                  referrerPolicy="no-referrer"
                  className="w-full h-52 object-cover rounded-lg"
                />
              )}
              <div className="text-xs text-[#806B50]">
                {selectedStoryModal.narratorName} · {selectedStoryModal.recordedDate}
              </div>
              <p className="text-sm text-[#1C1917] leading-loose whitespace-pre-line">
                {selectedStoryModal.contentFa}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Community Contribution Modal */}
      {contributionOpen && (
        <ContributionModal
          lang={lang}
          pickedCoords={pickedContributionCoords}
          onRequestMapPick={() => {
            setContributionOpen(false);
            setActiveSection('map');
            setViewMode('map');
            setPickingForContribution(true);
          }}
          onClose={() => setContributionOpen(false)}
        />
      )}

      {/* Minimal Editorial Footer (Hidden in Map workspace on mobile to preserve full screen map) */}
      <footer className="px-6 py-3 bg-[#EBE6DF] border-t border-[#806B50]/20 text-xs text-[#57534E] flex items-center justify-between gap-4 flex-wrap">
        <span>
          {lang === 'fa'
            ? 'مردمنگار برزک — سامانه دیجیتال میراث فرهنگی و مردم‌نگاری برزک کاشان'
            : 'Barzok People Map — Digital Ethnographic & Cultural Heritage Platform'}
        </span>
        <div className="flex items-center gap-4">
          <a href="?embed=1" target="_blank" rel="noopener noreferrer" className="hover:text-[#254B36]">
            {lang === 'fa' ? 'نمای جاسازی (embed)' : 'Embed View (embed)'}
          </a>
          <span>·</span>
          <button
            type="button"
            onClick={() => navigateToSection('admin')}
            className="hover:text-[#254B36]"
          >
            {lang === 'fa' ? 'پنل مدیریت (/admin)' : 'Admin CMS (/admin)'}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BarzokAppContent />
    </AuthProvider>
  );
}
