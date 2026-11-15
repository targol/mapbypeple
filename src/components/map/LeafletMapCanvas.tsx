import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './leaflet-overrides.css';
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import {
  Compass,
  Layers as LayersIcon,
  LocateFixed,
  Minus,
  Navigation,
  Plus,
  Route as RouteIcon,
} from 'lucide-react';
import { BARZOK_CENTER, LayerRecord, PlaceRecord } from '../../types';
import { LayerIcon } from '../LayerIcon';
import { distanceMeters } from '../../utils/geo';
import type { BarzokMapCanvasProps } from './mapTypes';
import { neighbourhoodPolygons } from '../../utils/neighbourhood';

type TileStyle = 'osm' | 'topo' | 'sat';

// Free, keyless tile sources. Both are built on OpenStreetMap data and require attribution.
// OSM's public tile servers are fine for a prototype; for a busy public site use a hosted
// provider or your own tile server (https://operations.osmfoundation.org/policies/tiles/).
const TILE_SOURCES: Record<
  TileStyle,
  { url: string; attribution: string; maxNativeZoom: number; subdomains?: string }
> = {
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
  // Satellite photos (Esri World Imagery): free without a key for light use, attribution required.
  // Zoomed past the last real tile level, Leaflet simply enlarges the tiles instead of showing grey.
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxNativeZoom: 18,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, SRTM | Style: <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a> (CC-BY-SA)',
    maxNativeZoom: 17,
    subdomains: 'abc',
  },
};

const MIN_ZOOM = 6;
const MAX_ZOOM = 19;
const LABEL_MIN_ZOOM = 17; // place names next to pins appear from this zoom level

// With ~200 places the pins must shrink when zoomed out, or they pile up on top of each other.
const pinSize = (zoom: number) => (zoom >= 18 ? 40 : zoom >= 17 ? 34 : zoom >= 16 ? 26 : 20);

interface PositionedPlace {
  place: PlaceRecord;
  displayLat: number;
  displayLng: number;
  coLocatedCount: number;
  layer?: LayerRecord;
}

const round6 = (n: number) => Number(n.toFixed(6));

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string
  );

function buildPlaceIcon(opts: {
  color: string;
  iconName: string;
  selected: boolean;
  count: number;
  label: string | null;
  size: number;
  dim?: boolean;
}) {
  const svg = renderToStaticMarkup(<LayerIcon name={opts.iconName} className="" />);
  const html = `
    <div class="barzok-pin${opts.selected ? ' is-selected' : ''}${opts.dim ? ' is-dim' : ''}" style="--s:${opts.size}px">
      <div class="barzok-pin__dot" style="background-color:${escapeHtml(opts.color)}">${svg}</div>
      ${opts.count > 1 && opts.size >= 26 ? `<span class="barzok-pin__count">${opts.count}</span>` : ''}
      ${opts.label ? `<div class="barzok-pin__label" dir="auto">${escapeHtml(opts.label)}</div>` : ''}
    </div>`;
  return L.divIcon({
    html,
    className: 'barzok-divicon',
    iconSize: [opts.size, opts.size],
    iconAnchor: [opts.size / 2, opts.size / 2],
  });
}

function buildPickIcon(coords: { lat: number; lng: number }) {
  return L.divIcon({
    html: `
      <div class="barzok-pickpin">
        <div class="barzok-pickpin__dot">+</div>
        <div class="barzok-pickpin__label">${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}</div>
      </div>`,
    className: 'barzok-divicon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

// The numbered badge is anchored so it sits at the top-left corner of the pin it belongs to.
function buildStopIcon(order: number) {
  return L.divIcon({
    html: `<div class="barzok-stop">${order}</div>`,
    className: 'barzok-divicon',
    iconSize: [22, 22],
    iconAnchor: [26, 26],
  });
}

const ME_ICON = L.divIcon({
  html: '<div class="barzok-me"><div class="barzok-me__pulse"></div><div class="barzok-me__dot"></div></div>',
  className: 'barzok-divicon',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Leaflet needs to be told when its container changes size (sidebar toggles, mobile sheet).
function SizeSync() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function MapEvents({
  pickMode,
  onPickCoords,
  onCenterChange,
  onZoomChange,
}: {
  pickMode: boolean;
  onPickCoords?: (coords: { lat: number; lng: number }) => void;
  onCenterChange: (center: { lat: number; lng: number }) => void;
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMapEvents({
    click(e) {
      if (pickMode && onPickCoords) {
        onPickCoords({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) });
      }
    },
    moveend() {
      const c = map.getCenter();
      onCenterChange({ lat: c.lat, lng: c.lng });
    },
    zoomend() {
      onZoomChange(map.getZoom());
    },
  });
  return null;
}

// Pan to a place when it becomes selected (from the sidebar, search or a marker).
function PanToSelected({ target }: { target: { id: string; lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.panTo([target.lat, target.lng], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id, target?.lat, target?.lng, map]);
  return null;
}

// Fit the map to the active route when it is chosen.
function FitRoute({ routeId, points }: { routeId: string | null; points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!routeId || points.length < 2) return;
    // leave room at the bottom for the route card
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: [30, 100],
      paddingBottomRight: [30, window.innerHeight < 700 ? 280 : 340],
      maxZoom: 17,
      animate: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, map]);
  return null;
}

// While following, keep the visitor in the middle of the map. Dragging the map hands control back.
function FollowUser({
  follow,
  position,
  onFollowChange,
}: {
  follow: boolean;
  position: { lat: number; lng: number } | null;
  onFollowChange?: (follow: boolean) => void;
}) {
  const map = useMap();
  useMapEvents({
    dragstart() {
      if (follow) onFollowChange?.(false);
    },
  });
  useEffect(() => {
    if (!follow || !position) return;
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 17), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, position?.lat, position?.lng, map]);
  return null;
}

// Blue dot + accuracy circle for the visitor; flies to them on the first GPS fix if they are
// near the village (someone browsing from far away keeps the village view).
function UserLayer({ position }: { position: { lat: number; lng: number; accuracy: number } | null }) {
  const map = useMap();
  const flewRef = useRef(false);
  useEffect(() => {
    if (!position) {
      flewRef.current = false;
      return;
    }
    if (flewRef.current) return;
    flewRef.current = true;
    const near =
      distanceMeters(position, { lat: BARZOK_CENTER.lat, lng: BARZOK_CENTER.lng }) < 5000;
    if (near) map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 17), { duration: 0.8 });
  }, [position, map]);

  if (!position) return null;
  return (
    <>
      {position.accuracy > 8 && (
        <Circle
          center={[position.lat, position.lng]}
          radius={position.accuracy}
          pathOptions={{ color: '#1a73e8', weight: 1, opacity: 0.5, fillColor: '#1a73e8', fillOpacity: 0.1 }}
          interactive={false}
        />
      )}
      <Marker
        position={[position.lat, position.lng]}
        icon={ME_ICON}
        interactive={false}
        zIndexOffset={3000}
      />
    </>
  );
}

export function LeafletMapCanvas({
  lang,
  layers,
  places,
  allPlaces,
  activeRoute,
  selectedPlaceId,
  onSelectPlace,
  pickMode = false,
  pickedCoords = null,
  onPickCoords,
  userPosition = null,
  onLocateMe,
  followUser = false,
  onFollowChange,
}: BarzokMapCanvasProps) {
  const [tileStyle, setTileStyle] = useState<TileStyle>('osm');
  const [showHoods, setShowHoods] = useState(true);
  const [map, setMap] = useState<L.Map | null>(null);
  const [zoom, setZoom] = useState<number>(BARZOK_CENTER.defaultZoom);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: BARZOK_CENTER.lat,
    lng: BARZOK_CENTER.lng,
  });

  const layerDict = useMemo(() => {
    const dict: Record<string, LayerRecord> = {};
    for (const l of layers) dict[l.id] = l;
    return dict;
  }, [layers]);

  const size = pinSize(zoom);
  const labelsOn = zoom >= LABEL_MIN_ZOOM;

  // Pins: every point place, plus a shape place only while it is selected (so its name shows).
  // Places that share the same coordinates are spread so each marker stays clickable.
  const positionedPlaces: PositionedPlace[] = useMemo(() => {
    const pins = places.filter((p) => !p.geometry || p.id === selectedPlaceId);
    const groups: Record<string, PlaceRecord[]> = {};
    for (const p of pins) {
      const key = `${p.latitude.toFixed(4)}_${p.longitude.toFixed(4)}`;
      (groups[key] ||= []).push(p);
    }
    const result: PositionedPlace[] = [];
    for (const group of Object.values(groups)) {
      group.forEach((place, idx) => {
        const layer = place.layerId ? layerDict[place.layerId] : undefined;
        if (group.length === 1) {
          result.push({
            place,
            displayLat: place.latitude,
            displayLng: place.longitude,
            coLocatedCount: 1,
            layer,
          });
        } else {
          const angle = (2 * Math.PI * idx) / group.length;
          const radiusOffset = 0.00022;
          result.push({
            place,
            displayLat: place.latitude + Math.sin(angle) * radiusOffset,
            displayLng: place.longitude + Math.cos(angle) * radiusOffset,
            coLocatedCount: group.length,
            layer,
          });
        }
      });
    }
    return result;
  }, [places, layerDict, selectedPlaceId]);

  const routeStopIds = useMemo(
    () => new Set((activeRoute?.stops ?? []).map((st) => st.placeId)),
    [activeRoute]
  );

  const markers = useMemo(
    () =>
      positionedPlaces.map((pp) => {
        const selected = selectedPlaceId === pp.place.id;
        return {
          ...pp,
          selected,
          icon: buildPlaceIcon({
            color: pp.layer?.color || '#254B36',
            iconName: pp.layer?.icon || 'landmark',
            selected,
            count: pp.coLocatedCount,
            dim: Boolean(activeRoute) && !routeStopIds.has(pp.place.id) && !selected,
            label:
              labelsOn || selected || (activeRoute && zoom >= 16 && routeStopIds.has(pp.place.id))
                ? lang === 'fa'
                  ? pp.place.nameFa
                  : pp.place.nameEn || pp.place.nameFa
                : null,
            size: selected ? Math.max(size, 34) : size,
          }),
        };
      }),
    [positionedPlaces, selectedPlaceId, lang, labelsOn, size, activeRoute, routeStopIds, zoom]
  );

  // Neighbourhood outlines + names, drawn even when the neighbourhood layer itself is switched off.
  const hoodOverlay = useMemo(() => {
    const visible = new Set(places.map((p) => p.id));
    return neighbourhoodPolygons(allPlaces ?? places).map((h) => {
      const ring = h.geometry!.coordinates;
      const lat = ring.reduce((a, c) => a + c[0], 0) / ring.length;
      const lng = ring.reduce((a, c) => a + c[1], 0) / ring.length;
      return { place: h, ring, center: [lat, lng] as [number, number], layerShown: visible.has(h.id) };
    });
  }, [allPlaces, places]);

  const shapes = useMemo(() => places.filter((p) => p.geometry), [places]);

  const routeData = useMemo(() => {
    if (!activeRoute) return { line: [] as [number, number][], stops: [] as { order: number; pos: [number, number] }[] };
    const byId: Record<string, PlaceRecord> = {};
    for (const p of allPlaces ?? places) byId[p.id] = p;
    const ordered = [...(activeRoute.stops || [])].sort((a, b) => a.stopOrder - b.stopOrder);
    const stops = ordered
      .map((s, idx) => {
        const p = byId[s.placeId];
        return p ? { order: idx + 1, pos: [p.latitude, p.longitude] as [number, number] } : null;
      })
      .filter(Boolean) as { order: number; pos: [number, number] }[];
    // Prefer the recorded GPS track; otherwise connect the stops with straight lines.
    const line =
      activeRoute.track && activeRoute.track.length >= 2
        ? activeRoute.track
        : stops.length >= 2
        ? stops.map((s) => s.pos)
        : [];
    return { line, stops };
  }, [activeRoute, allPlaces, places]);

  const pickIcon = useMemo(
    () => (pickMode && pickedCoords ? buildPickIcon(pickedCoords) : null),
    [pickMode, pickedCoords?.lat, pickedCoords?.lng]
  );

  const selectedTarget = useMemo(() => {
    if (!selectedPlaceId) return null;
    const p = places.find((x) => x.id === selectedPlaceId);
    return p ? { id: p.id, lat: p.latitude, lng: p.longitude } : null;
  }, [selectedPlaceId, places]);

  const tiles = TILE_SOURCES[tileStyle];

  const handleResetCenter = () => {
    map?.setView([BARZOK_CENTER.lat, BARZOK_CENTER.lng], BARZOK_CENTER.defaultZoom, { animate: true });
  };

  const handleLocate = () => {
    onLocateMe?.();
    onFollowChange?.(true);
    if (userPosition && map) {
      map.flyTo([userPosition.lat, userPosition.lng], Math.max(map.getZoom(), 17), { duration: 0.6 });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[320px] bg-[#E5E0D5] overflow-hidden select-none">
      {/* `isolate` keeps Leaflet's high z-index panes below our overlay controls */}
      <div className="absolute inset-0 isolate">
        <MapContainer
          ref={setMap}
          center={[BARZOK_CENTER.lat, BARZOK_CENTER.lng]}
          zoom={BARZOK_CENTER.defaultZoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          zoomControl={false}
          scrollWheelZoom
          className={`barzok-leaflet w-full h-full${pickMode ? ' barzok-pick-mode' : ''}`}
        >
          <TileLayer
            key={tileStyle}
            url={tiles.url}
            attribution={tiles.attribution}
            maxNativeZoom={tiles.maxNativeZoom}
            maxZoom={MAX_ZOOM}
            subdomains={tiles.subdomains ?? 'abc'}
          />
          <SizeSync />
          <MapEvents
            pickMode={pickMode}
            onPickCoords={onPickCoords}
            onCenterChange={setCenter}
            onZoomChange={setZoom}
          />
          <PanToSelected target={selectedTarget} />
          <FitRoute routeId={activeRoute?.id ?? null} points={routeData.line} />

          {/* Neighbourhood boundaries and names */}
          {showHoods &&
            hoodOverlay.map((h) => (
              <React.Fragment key={`hood-${h.place.id}`}>
                {!h.layerShown && (
                  <Polygon
                    positions={h.ring}
                    interactive={false}
                    pathOptions={{ color: h.place.geometry?.color || '#7A4E9C', weight: 2, dashArray: '8 6', fillOpacity: 0.04 }}
                  />
                )}
                <Marker
                  position={h.center}
                  interactive={false}
                  icon={L.divIcon({
                    html: `<div class="barzok-hood-label" dir="auto">${escapeHtml(
                      lang === 'fa' ? h.place.nameFa : h.place.nameEn || h.place.nameFa
                    )}</div>`,
                    className: 'barzok-divicon',
                    iconSize: [0, 0],
                  })}
                />
              </React.Fragment>
            ))}

          {/* Lines and areas (water channels, gardens, neighbourhoods, streets, hills) */}
          {shapes.map((p) => {
            const g = p.geometry!;
            const layer = p.layerId ? layerDict[p.layerId] : undefined;
            const color = g.color || layer?.color || '#254B36';
            const selected = p.id === selectedPlaceId;
            const handlers = { click: () => onSelectPlace(p) };
            if (g.type === 'Polygon') {
              return (
                <Polygon
                  key={p.id}
                  positions={g.coordinates}
                  interactive={!pickMode}
                  eventHandlers={handlers}
                  pathOptions={{
                    color,
                    weight: selected ? 4 : 2,
                    opacity: selected ? 1 : 0.85,
                    fillColor: color,
                    fillOpacity: selected ? 0.45 : Math.min(g.fillOpacity ?? 0.3, 0.35),
                  }}
                />
              );
            }
            return (
              <React.Fragment key={p.id}>
                {/* wide invisible stroke so thin lines are easy to tap on a phone */}
                <Polyline
                  positions={g.coordinates}
                  interactive={!pickMode}
                  eventHandlers={handlers}
                  pathOptions={{ color, weight: 18, opacity: 0.01 }}
                />
                <Polyline
                  positions={g.coordinates}
                  interactive={false}
                  pathOptions={{
                    color,
                    weight: selected ? 7 : 4,
                    opacity: selected ? 1 : 0.85,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </React.Fragment>
            );
          })}

          {/* Active route: recorded track (or straight lines) + numbered stops */}
          {routeData.line.length >= 2 && (
            <>
              <Polyline
                positions={routeData.line}
                pathOptions={{ color: '#1C1917', opacity: 0.35, weight: 9, lineCap: 'round', lineJoin: 'round' }}
                interactive={false}
              />
              <Polyline
                positions={routeData.line}
                pathOptions={{
                  color: activeRoute?.color || '#D6A83F',
                  weight: 5,
                  dashArray: '10 6',
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                interactive={false}
              />
            </>
          )}
          {routeData.stops.map((st) => (
            <Marker
              key={`stop-${st.order}`}
              position={st.pos}
              icon={buildStopIcon(st.order)}
              interactive={false}
              zIndexOffset={1500}
            />
          ))}

          {markers.map((m) => (
            <Marker
              key={m.place.id}
              position={[m.displayLat, m.displayLng]}
              icon={m.icon}
              zIndexOffset={m.selected ? 1000 : 0}
              title={lang === 'fa' ? m.place.nameFa : m.place.nameEn || m.place.nameFa}
              eventHandlers={{ click: () => onSelectPlace(m.place) }}
            />
          ))}

          {pickMode && pickedCoords && pickIcon && (
            <Marker
              position={[pickedCoords.lat, pickedCoords.lng]}
              icon={pickIcon}
              interactive={false}
              zIndexOffset={2000}
            />
          )}

          <UserLayer position={userPosition} />
          <FollowUser follow={followUser} position={userPosition} onFollowChange={onFollowChange} />
        </MapContainer>
      </div>

      {/* Map style switcher + zoom controls */}
      <div className="absolute bottom-8 left-3 sm:left-5 z-30 flex flex-col gap-2">
        <div className="flex items-center bg-[#F5F2E9]/95 border border-[#806B50]/35 rounded-lg shadow-md p-1 gap-1">
          <LayersIcon className="w-3.5 h-3.5 text-[#254B36] mx-1 hidden sm:inline" />
          {[
            { id: 'osm' as TileStyle, labelFa: 'نقشه خیابان‌ها', labelEn: 'Map' },
            { id: 'sat' as TileStyle, labelFa: 'ماهواره', labelEn: 'Satellite' },
            { id: 'topo' as TileStyle, labelFa: 'توپوگرافی', labelEn: 'Terrain' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setTileStyle(mode.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                tileStyle === mode.id
                  ? 'bg-[#254B36] text-[#F5F2E9] shadow-sm'
                  : 'text-[#1C1917] hover:bg-[#EBE6DF]'
              }`}
            >
              {lang === 'fa' ? mode.labelFa : mode.labelEn}
            </button>
          ))}
        </div>

        {hoodOverlay.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHoods((v) => !v)}
            aria-pressed={showHoods}
            className={`px-3 py-1.5 rounded-lg border border-[#806B50]/35 shadow-md text-[11px] font-semibold w-fit ${
              showHoods ? 'bg-[#254B36] text-[#F5F2E9]' : 'bg-[#F5F2E9]/95 text-[#1C1917]'
            }`}
          >
            {lang === 'fa' ? 'مرز و نام محله‌ها' : 'Neighbourhoods'}
          </button>
        )}

        <div className="flex flex-col bg-[#F5F2E9]/95 border border-[#806B50]/35 rounded-lg shadow-md overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => map?.zoomIn()}
            title={lang === 'fa' ? 'بزرگ‌نمایی' : 'Zoom in'}
            className="p-2.5 text-[#1C1917] hover:bg-[#EBE6DF] transition-colors border-b border-[#806B50]/20 flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => map?.zoomOut()}
            title={lang === 'fa' ? 'کوچک‌نمایی' : 'Zoom out'}
            className="p-2.5 text-[#1C1917] hover:bg-[#EBE6DF] transition-colors border-b border-[#806B50]/20 flex items-center justify-center"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetCenter}
            title={lang === 'fa' ? 'بازگشت به مرکز برزک' : 'Return to Barzok center'}
            className={`p-2.5 text-[#254B36] hover:bg-[#EBE6DF] transition-colors flex items-center justify-center ${
              onLocateMe ? 'border-b border-[#806B50]/20' : ''
            }`}
          >
            <LocateFixed className="w-4 h-4" />
          </button>
          {onLocateMe && (
            <button
              type="button"
              onClick={handleLocate}
              title={lang === 'fa' ? 'مکان من و دنبال کردن' : 'My location (follow)'}
              aria-label={lang === 'fa' ? 'مکان من' : 'My location'}
              className={`p-2.5 hover:bg-[#EBE6DF] transition-colors flex items-center justify-center ${
                followUser ? 'bg-[#1a73e8] text-white' : userPosition ? 'text-[#1a73e8]' : 'text-[#1C1917]'
              }`}
            >
              <Navigation className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Coordinate & active route status bar (sits above Leaflet's attribution line) */}
      <div className="absolute bottom-8 right-5 z-20 hidden md:flex items-center gap-3 px-3.5 py-2 rounded-lg bg-[#F5F2E9]/95 border border-[#806B50]/35 shadow-md text-xs text-[#57534E]">
        <Compass className="w-4 h-4 text-[#254B36] shrink-0" />
        <span className="font-mono-num" dir="ltr">
          {center.lat.toFixed(4)}° N, {center.lng.toFixed(4)}° E
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {lang === 'fa' ? `${places.length} مکان فعال` : `${places.length} active locations`}
        </span>
        {activeRoute && (
          <>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1 text-[#254B36] font-semibold">
              <RouteIcon className="w-3.5 h-3.5" />
              {lang === 'fa' ? activeRoute.titleFa : activeRoute.titleEn || activeRoute.titleFa}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
