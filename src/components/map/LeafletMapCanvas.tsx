import React, { useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './leaflet-overrides.css';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import {
  Compass,
  Layers as LayersIcon,
  LocateFixed,
  Minus,
  Plus,
  Route as RouteIcon,
} from 'lucide-react';
import { BARZOK_CENTER, LayerRecord, PlaceRecord } from '../../types';
import { LayerIcon } from '../LayerIcon';
import type { BarzokMapCanvasProps } from './mapTypes';

type TileStyle = 'osm' | 'topo';

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
  label: string;
}) {
  const svg = renderToStaticMarkup(<LayerIcon name={opts.iconName} className="" />);
  const html = `
    <div class="barzok-pin${opts.selected ? ' is-selected' : ''}">
      <div class="barzok-pin__dot" style="background-color:${escapeHtml(opts.color)}">${svg}</div>
      ${opts.count > 1 ? `<span class="barzok-pin__count">${opts.count}</span>` : ''}
      <div class="barzok-pin__label" dir="auto">${escapeHtml(opts.label)}</div>
    </div>`;
  return L.divIcon({
    html,
    className: 'barzok-divicon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
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

function buildStopIcon(order: number) {
  return L.divIcon({
    html: `<div class="barzok-stop">${order}</div>`,
    className: 'barzok-divicon',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

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
}: {
  pickMode: boolean;
  onPickCoords?: (coords: { lat: number; lng: number }) => void;
  onCenterChange: (center: { lat: number; lng: number }) => void;
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

export function LeafletMapCanvas({
  lang,
  layers,
  places,
  activeRoute,
  selectedPlaceId,
  onSelectPlace,
  pickMode = false,
  pickedCoords = null,
  onPickCoords,
}: BarzokMapCanvasProps) {
  const [tileStyle, setTileStyle] = useState<TileStyle>('osm');
  const [map, setMap] = useState<L.Map | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: BARZOK_CENTER.lat,
    lng: BARZOK_CENTER.lng,
  });

  const layerDict = useMemo(() => {
    const dict: Record<string, LayerRecord> = {};
    for (const l of layers) dict[l.id] = l;
    return dict;
  }, [layers]);

  // Spread places that share the same coordinates so each marker stays clickable.
  const positionedPlaces: PositionedPlace[] = useMemo(() => {
    const groups: Record<string, PlaceRecord[]> = {};
    for (const p of places) {
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
          const radiusOffset = 0.00032;
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
  }, [places, layerDict]);

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
            label: lang === 'fa' ? pp.place.nameFa : pp.place.nameEn || pp.place.nameFa,
          }),
        };
      }),
    [positionedPlaces, selectedPlaceId, lang]
  );

  const routeData = useMemo(() => {
    if (!activeRoute || !activeRoute.stops || activeRoute.stops.length === 0) {
      return { line: [] as [number, number][], stops: [] as { order: number; pos: [number, number] }[] };
    }
    const byId: Record<string, PlaceRecord> = {};
    for (const p of places) byId[p.id] = p;
    const ordered = [...activeRoute.stops].sort((a, b) => a.stopOrder - b.stopOrder);
    const stops = ordered
      .map((s, idx) => {
        const p = byId[s.placeId];
        return p ? { order: idx + 1, pos: [p.latitude, p.longitude] as [number, number] } : null;
      })
      .filter(Boolean) as { order: number; pos: [number, number] }[];
    return { line: stops.length >= 2 ? stops.map((s) => s.pos) : [], stops };
  }, [activeRoute, places]);

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

  return (
    <div className="relative w-full h-full min-h-[420px] bg-[#E5E0D5] overflow-hidden select-none">
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
          <MapEvents pickMode={pickMode} onPickCoords={onPickCoords} onCenterChange={setCenter} />
          <PanToSelected target={selectedTarget} />

          {routeData.line.length >= 2 && (
            <>
              <Polyline
                positions={routeData.line}
                pathOptions={{ color: '#1C1917', opacity: 0.35, weight: 7, lineCap: 'round', lineJoin: 'round' }}
                interactive={false}
              />
              <Polyline
                positions={routeData.line}
                pathOptions={{
                  color: activeRoute?.color || '#D6A83F',
                  weight: 4.5,
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
              zIndexOffset={500}
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
        </MapContainer>
      </div>

      {/* Map style switcher + zoom controls */}
      <div className="absolute bottom-8 left-5 z-30 flex flex-col gap-2">
        <div className="flex items-center bg-[#F5F2E9]/95 border border-[#806B50]/35 rounded-lg shadow-md p-1 gap-1">
          <LayersIcon className="w-3.5 h-3.5 text-[#254B36] mx-1 hidden sm:inline" />
          {[
            { id: 'osm' as TileStyle, labelFa: 'نقشه خیابان‌ها', labelEn: 'Map' },
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
            className="p-2.5 text-[#254B36] hover:bg-[#EBE6DF] transition-colors flex items-center justify-center"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Coordinate & active route status bar (sits above Leaflet's attribution line) */}
      <div className="absolute bottom-8 right-5 z-20 hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-lg bg-[#F5F2E9]/95 border border-[#806B50]/35 shadow-md text-xs text-[#57534E]">
        <Compass className="w-4 h-4 text-[#254B36] shrink-0" />
        <span className="font-mono-num" dir="ltr">
          {center.lat.toFixed(4)}° N, {center.lng.toFixed(4)}° E
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {lang === 'fa'
            ? `${positionedPlaces.length} مکان فعال`
            : `${positionedPlaces.length} active locations`}
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
