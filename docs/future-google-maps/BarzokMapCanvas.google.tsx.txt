import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  Layers as LayersIcon,
  LocateFixed,
  Minus,
  Plus,
  Route as RouteIcon,
} from 'lucide-react';
import {
  BARZOK_CENTER,
  Language,
  LayerRecord,
  PlaceRecord,
  RouteRecord,
} from '../types';
import { LayerIcon } from './LayerIcon';

interface BarzokMapCanvasProps {
  lang: Language;
  layers: LayerRecord[];
  places: PlaceRecord[];
  activeRoute: RouteRecord | null;
  selectedPlaceId: string | null;
  onSelectPlace: (place: PlaceRecord) => void;
  pickMode?: boolean;
  pickedCoords?: { lat: number; lng: number } | null;
  onPickCoords?: (coords: { lat: number; lng: number }) => void;
}

interface PositionedPlace {
  place: PlaceRecord;
  displayLat: number;
  displayLng: number;
  coLocatedCount: number;
  coLocatedIndex: number;
  layer?: LayerRecord;
}

type TileLayerStyle = 'm' | 'y' | 'p';

const TILE_SIZE = 256;

// Standard Web Mercator projection (exact pixel math used by Google Maps)
function latLngToWorldPixel(lat: number, lng: number, zoom: number) {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const x = ((lng + 180) / 360) * scale;
  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function worldPixelToLatLng(x: number, y: number, zoom: number) {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

export function BarzokMapCanvas({
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
  const apiKey =
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
    (typeof process !== 'undefined' &&
      (process.env?.GOOGLE_MAPS_PLATFORM_API_KEY as string)) ||
    '';

  const [useSdkEngine, setUseSdkEngine] = useState<boolean>(Boolean(apiKey));
  const [tileStyle, setTileStyle] = useState<TileLayerStyle>('m'); // 'm' = Road Map, 'y' = Satellite Hybrid, 'p' = Terrain
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: BARZOK_CENTER.lat,
    lng: BARZOK_CENTER.lng,
  });
  const [zoom, setZoom] = useState<number>(BARZOK_CENTER.defaultZoom);

  // Viewport measurement for exact Web Mercator tile placement
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({
    width: 1000,
    height: 680,
  });

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragOriginRef = useRef<{
    clientX: number;
    clientY: number;
    startWorldX: number;
    startWorldY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Center map on selected place when chosen from sidebar/search
  useEffect(() => {
    if (!selectedPlaceId) return;
    const found = places.find((p) => p.id === selectedPlaceId);
    if (found) {
      setCenter({ lat: found.latitude, lng: found.longitude });
    }
  }, [selectedPlaceId, places]);

  // Build dictionary using Record to avoid shadowing global Map constructor
  const layerDict = useMemo(() => {
    const dict: Record<string, LayerRecord> = {};
    for (const l of layers) {
      dict[l.id] = l;
    }
    return dict;
  }, [layers]);

  // Offset multiple markers at the exact same location so all remain clickable
  const positionedPlaces: PositionedPlace[] = useMemo(() => {
    const groups: Record<string, PlaceRecord[]> = {};
    for (const p of places) {
      const key = `${p.latitude.toFixed(4)}_${p.longitude.toFixed(4)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }

    const result: PositionedPlace[] = [];
    for (const key of Object.keys(groups)) {
      const group = groups[key];
      group.forEach((place, idx) => {
        if (group.length === 1) {
          result.push({
            place,
            displayLat: place.latitude,
            displayLng: place.longitude,
            coLocatedCount: 1,
            coLocatedIndex: 0,
            layer: place.layerId ? layerDict[place.layerId] : undefined,
          });
        } else {
          const angle = (2 * Math.PI * idx) / group.length;
          const radiusOffset = 0.00032;
          result.push({
            place,
            displayLat: place.latitude + Math.sin(angle) * radiusOffset,
            displayLng: place.longitude + Math.cos(angle) * radiusOffset,
            coLocatedCount: group.length,
            coLocatedIndex: idx,
            layer: place.layerId ? layerDict[place.layerId] : undefined,
          });
        }
      });
    }
    return result;
  }, [places, layerDict]);

  const handleResetCenter = () => {
    setCenter({ lat: BARZOK_CENTER.lat, lng: BARZOK_CENTER.lng });
    setZoom(BARZOK_CENTER.defaultZoom);
  };

  const intZoom = Math.max(4, Math.min(19, Math.round(zoom)));

  const centerWorld = useMemo(
    () => latLngToWorldPixel(center.lat, center.lng, intZoom),
    [center.lat, center.lng, intZoom]
  );

  // Convert any lat/lng to exact pixel coordinates inside the viewport container
  const latLngToContainerPixel = (lat: number, lng: number) => {
    const pt = latLngToWorldPixel(lat, lng, intZoom);
    return {
      x: viewport.width / 2 + (pt.x - centerWorld.x),
      y: viewport.height / 2 + (pt.y - centerWorld.y),
    };
  };

  // Compute visible Google Map tiles covering the current viewport
  const visibleTiles = useMemo(() => {
    const maxTileIndex = Math.pow(2, intZoom) - 1;
    const minTileX = Math.floor((centerWorld.x - viewport.width / 2) / TILE_SIZE) - 1;
    const maxTileX = Math.floor((centerWorld.x + viewport.width / 2) / TILE_SIZE) + 1;
    const minTileY = Math.floor((centerWorld.y - viewport.height / 2) / TILE_SIZE) - 1;
    const maxTileY = Math.floor((centerWorld.y + viewport.height / 2) / TILE_SIZE) + 1;

    const tiles: {
      key: string;
      tx: number;
      ty: number;
      left: number;
      top: number;
      url: string;
      fallbackUrl: string;
    }[] = [];

    const hl = lang === 'fa' ? 'fa' : 'en';

    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (ty < 0 || ty > maxTileIndex) continue;
        const wrappedTx = ((tx % (maxTileIndex + 1)) + (maxTileIndex + 1)) % (maxTileIndex + 1);
        const left = Math.round(viewport.width / 2 + (tx * TILE_SIZE - centerWorld.x));
        const top = Math.round(viewport.height / 2 + (ty * TILE_SIZE - centerWorld.y));
        const subdomain = Math.abs(wrappedTx + ty) % 4;
        const url = `https://mt${subdomain}.google.com/vt/lyrs=${tileStyle}&x=${wrappedTx}&y=${ty}&z=${intZoom}&hl=${hl}`;
        const fallbackUrl = `https://tile.openstreetmap.org/${intZoom}/${wrappedTx}/${ty}.png`;
        tiles.push({
          key: `${intZoom}_${tileStyle}_${tx}_${ty}`,
          tx: wrappedTx,
          ty,
          left,
          top,
          url,
          fallbackUrl,
        });
      }
    }
    return tiles;
  }, [centerWorld.x, centerWorld.y, viewport.width, viewport.height, intZoom, tileStyle, lang]);

  // Active Walking Route Polyline points in exact viewport pixels
  const routePolylineData = useMemo(() => {
    if (!activeRoute || !activeRoute.stops || activeRoute.stops.length === 0) {
      return { pointsStr: '', stopCoords: [] as { x: number; y: number; order: number; name: string }[] };
    }
    const placeById: Record<string, PlaceRecord> = {};
    for (const p of places) placeById[p.id] = p;

    const orderedStops = [...activeRoute.stops].sort((a, b) => a.stopOrder - b.stopOrder);
    const stopCoords = orderedStops
      .map((s, idx) => {
        const p = placeById[s.placeId];
        if (!p) return null;
        const pt = latLngToContainerPixel(p.latitude, p.longitude);
        return {
          x: pt.x,
          y: pt.y,
          order: idx + 1,
          name: lang === 'fa' ? p.nameFa : p.nameEn || p.nameFa,
        };
      })
      .filter(Boolean) as { x: number; y: number; order: number; name: string }[];

    if (stopCoords.length < 2) {
      return { pointsStr: '', stopCoords };
    }
    return {
      pointsStr: stopCoords.map((pt) => `${pt.x},${pt.y}`).join(' '),
      stopCoords,
    };
  }, [activeRoute, places, centerWorld.x, centerWorld.y, viewport.width, viewport.height, intZoom, lang]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] bg-[#E5E0D5] overflow-hidden select-none"
    >
      {/* Mode 1: Official @vis.gl/react-google-maps SDK when API key is configured */}
      {apiKey && useSdkEngine ? (
        <APIProvider
          apiKey={apiKey}
          language={lang === 'fa' ? 'fa' : 'en'}
          region="IR"
        >
          <div className="w-full h-full min-h-[420px]">
            <GoogleMap
              mapId="DEMO_MAP_ID"
              defaultCenter={{ lat: BARZOK_CENTER.lat, lng: BARZOK_CENTER.lng }}
              defaultZoom={BARZOK_CENTER.defaultZoom}
              center={center}
              zoom={intZoom}
              mapTypeId={
                tileStyle === 'y'
                  ? 'hybrid'
                  : tileStyle === 'p'
                  ? 'terrain'
                  : 'roadmap'
              }
              onCameraChanged={(ev) => {
                setCenter(ev.detail.center);
                setZoom(ev.detail.zoom);
              }}
              onClick={(ev) => {
                if (pickMode && onPickCoords && ev.detail.latLng) {
                  onPickCoords({
                    lat: Number(ev.detail.latLng.lat.toFixed(6)),
                    lng: Number(ev.detail.latLng.lng.toFixed(6)),
                  });
                }
              }}
              gestureHandling="greedy"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              className="w-full h-full"
            >
              {positionedPlaces.map(({ place, displayLat, displayLng, layer, coLocatedCount }) => {
                const isSelected = selectedPlaceId === place.id;
                const markerColor = layer?.color || '#254B36';
                return (
                  <AdvancedMarker
                    key={place.id}
                    position={{ lat: displayLat, lng: displayLng }}
                    onClick={() => onSelectPlace(place)}
                    title={lang === 'fa' ? place.nameFa : place.nameEn || place.nameFa}
                  >
                    <div
                      className={`group relative flex items-center justify-center transition-transform duration-150 cursor-pointer ${
                        isSelected ? 'scale-125 z-30' : 'hover:scale-110 z-10'
                      }`}
                    >
                      <div
                        style={{ backgroundColor: markerColor }}
                        className={`w-10 h-10 rounded-full text-[#F5F2E9] shadow-md flex items-center justify-center border-2 ${
                          isSelected ? 'border-[#D6A83F] ring-4 ring-[#D6A83F]/40' : 'border-[#F5F2E9]'
                        }`}
                      >
                        <LayerIcon name={layer?.icon || 'landmark'} className="w-5 h-5" />
                      </div>
                      {coLocatedCount > 1 && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#D6A83F] text-[#1C1917] text-[10px] font-bold flex items-center justify-center font-mono-num border border-[#F5F2E9]">
                          {coLocatedCount}
                        </span>
                      )}
                    </div>
                  </AdvancedMarker>
                );
              })}

              {pickMode && pickedCoords && (
                <AdvancedMarker position={pickedCoords}>
                  <div className="w-8 h-8 rounded-full bg-[#D6A83F] border-2 border-[#1C1917] shadow-lg flex items-center justify-center text-[#1C1917] font-bold">
                    +
                  </div>
                </AdvancedMarker>
              )}
            </GoogleMap>
          </div>
        </APIProvider>
      ) : (
        /* Mode 2: Full Interactive Web Mercator Google Map of Barzok (Road, Satellite Hybrid & Terrain) */
        <div
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            setIsDragging(true);
            dragOriginRef.current = {
              clientX: e.clientX,
              clientY: e.clientY,
              startWorldX: centerWorld.x,
              startWorldY: centerWorld.y,
              moved: false,
            };
          }}
          onMouseMove={(e) => {
            if (!isDragging || !dragOriginRef.current) return;
            const dx = e.clientX - dragOriginRef.current.clientX;
            const dy = e.clientY - dragOriginRef.current.clientY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
              dragOriginRef.current.moved = true;
            }
            const nextCenter = worldPixelToLatLng(
              dragOriginRef.current.startWorldX - dx,
              dragOriginRef.current.startWorldY - dy,
              intZoom
            );
            setCenter(nextCenter);
          }}
          onMouseUp={(e) => {
            const wasMoved = dragOriginRef.current?.moved || false;
            setIsDragging(false);
            dragOriginRef.current = null;

            if (!wasMoved && pickMode && onPickCoords && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const clickY = e.clientY - rect.top;
              const worldX = centerWorld.x + (clickX - viewport.width / 2);
              const worldY = centerWorld.y + (clickY - viewport.height / 2);
              const coords = worldPixelToLatLng(worldX, worldY, intZoom);
              onPickCoords(coords);
            }
          }}
          onMouseLeave={() => {
            setIsDragging(false);
            dragOriginRef.current = null;
          }}
          onTouchStart={(e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            setIsDragging(true);
            dragOriginRef.current = {
              clientX: touch.clientX,
              clientY: touch.clientY,
              startWorldX: centerWorld.x,
              startWorldY: centerWorld.y,
              moved: false,
            };
          }}
          onTouchMove={(e) => {
            if (!isDragging || !dragOriginRef.current || e.touches.length !== 1) return;
            const touch = e.touches[0];
            const dx = touch.clientX - dragOriginRef.current.clientX;
            const dy = touch.clientY - dragOriginRef.current.clientY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
              dragOriginRef.current.moved = true;
            }
            const nextCenter = worldPixelToLatLng(
              dragOriginRef.current.startWorldX - dx,
              dragOriginRef.current.startWorldY - dy,
              intZoom
            );
            setCenter(nextCenter);
          }}
          onTouchEnd={() => {
            setIsDragging(false);
            dragOriginRef.current = null;
          }}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1 : -1;
            setZoom((z) => Math.max(6, Math.min(19, Math.round(z + delta))));
          }}
          className={`relative w-full h-full min-h-[420px] overflow-hidden ${
            pickMode ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {/* Real Google Maps Tile Layer (Road / Hybrid Satellite / Terrain) */}
          <div className="absolute inset-0 pointer-events-none">
            {visibleTiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.url}
                alt=""
                draggable={false}
                style={{
                  left: `${tile.left}px`,
                  top: `${tile.top}px`,
                  width: `${TILE_SIZE}px`,
                  height: `${TILE_SIZE}px`,
                }}
                onError={(ev) => {
                  const target = ev.currentTarget;
                  if (target.src !== tile.fallbackUrl) {
                    target.src = tile.fallbackUrl;
                  }
                }}
                className="absolute max-w-none select-none pointer-events-none"
              />
            ))}
          </div>

          {/* Walking Route Polyline Overlay */}
          {routePolylineData.pointsStr && (
            <svg
              width={viewport.width}
              height={viewport.height}
              className="absolute inset-0 pointer-events-none z-10"
            >
              <polyline
                points={routePolylineData.pointsStr}
                fill="none"
                stroke="#1C1917"
                strokeOpacity="0.35"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={routePolylineData.pointsStr}
                fill="none"
                stroke={activeRoute?.color || '#D6A83F'}
                strokeWidth="4.5"
                strokeDasharray="10 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {routePolylineData.stopCoords.map((st) => (
                <g key={st.order} transform={`translate(${st.x}, ${st.y})`}>
                  <circle r="11" fill="#D6A83F" stroke="#1C1917" strokeWidth="2" />
                  <text
                    textAnchor="middle"
                    dy="4"
                    fill="#1C1917"
                    fontSize="11"
                    fontWeight="bold"
                  >
                    {st.order}
                  </text>
                </g>
              ))}
            </svg>
          )}

          {/* Dynamic Layer Markers positioned at exact Web Mercator coordinates */}
          {positionedPlaces.map(({ place, displayLat, displayLng, layer, coLocatedCount }) => {
            const pos = latLngToContainerPixel(displayLat, displayLng);
            const isSelected = selectedPlaceId === place.id;
            const markerColor = layer?.color || '#254B36';

            // Cull markers far outside viewport
            if (
              pos.x < -80 ||
              pos.x > viewport.width + 80 ||
              pos.y < -80 ||
              pos.y > viewport.height + 80
            ) {
              return null;
            }

            return (
              <button
                key={place.id}
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPlace(place);
                }}
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                }}
                className={`group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-transform duration-150 focus:outline-none ${
                  isSelected ? 'scale-125 z-30' : 'hover:scale-110 z-20'
                }`}
                aria-label={lang === 'fa' ? place.nameFa : place.nameEn || place.nameFa}
              >
                <div
                  style={{ backgroundColor: markerColor }}
                  className={`relative w-10 h-10 rounded-full text-[#F5F2E9] shadow-lg flex items-center justify-center border-2 transition-colors ${
                    isSelected
                      ? 'border-[#D6A83F] ring-4 ring-[#D6A83F]/50'
                      : 'border-[#F5F2E9]'
                  }`}
                >
                  <LayerIcon name={layer?.icon || 'landmark'} className="w-5 h-5" />
                  {coLocatedCount > 1 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#D6A83F] text-[#1C1917] text-[10px] font-bold flex items-center justify-center font-mono-num border border-[#F5F2E9]">
                      {coLocatedCount}
                    </span>
                  )}
                </div>
                <div
                  className={`mt-1 px-2.5 py-0.5 rounded bg-[#F5F2E9]/95 border border-[#806B50]/40 shadow-md text-[11px] font-semibold text-[#1C1917] whitespace-nowrap max-w-[190px] truncate ${
                    isSelected ? 'ring-2 ring-[#254B36] bg-white' : ''
                  }`}
                >
                  {lang === 'fa' ? place.nameFa : place.nameEn || place.nameFa}
                </div>
              </button>
            );
          })}

          {/* Picked Coordinate Pin (Admin / Community Contribution Mode) */}
          {pickMode && pickedCoords && (
            <div
              style={{
                left: `${latLngToContainerPixel(pickedCoords.lat, pickedCoords.lng).x}px`,
                top: `${latLngToContainerPixel(pickedCoords.lat, pickedCoords.lng).y}px`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none flex flex-col items-center"
            >
              <div className="w-9 h-9 rounded-full bg-[#D6A83F] text-[#1C1917] border-2 border-[#1C1917] shadow-xl flex items-center justify-center font-bold animate-bounce">
                +
              </div>
              <span className="mt-1 px-2 py-0.5 rounded bg-[#1C1917] text-[#F5F2E9] text-[10px] font-mono-num whitespace-nowrap shadow">
                {pickedCoords.lat.toFixed(5)}, {pickedCoords.lng.toFixed(5)}
              </span>
            </div>
          )}

          {/* Google Maps Attribution Badge */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-2 py-0.5 rounded bg-white/80 text-[10px] text-[#57534E] shadow-sm">
            Map data ©2026 Google · Barzok (33.7925°N, 51.2292°E)
          </div>
        </div>
      )}

      {/* Map Type Switcher (Road Map / Satellite Hybrid / Terrain) + Zoom Controls */}
      <div className="absolute bottom-5 left-5 z-30 flex flex-col gap-2">
        {/* Map Type Switcher */}
        <div className="flex items-center bg-[#F5F2E9]/95 border border-[#806B50]/35 rounded-lg shadow-md p-1 gap-1">
          <LayersIcon className="w-3.5 h-3.5 text-[#254B36] mx-1 hidden sm:inline" />
          {[
            { id: 'm' as TileLayerStyle, labelFa: 'نقشه خیابان‌ها', labelEn: 'Map' },
            { id: 'y' as TileLayerStyle, labelFa: 'ماهواره‌ای', labelEn: 'Satellite' },
            { id: 'p' as TileLayerStyle, labelFa: 'توپوگرافی', labelEn: 'Terrain' },
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

        {/* Zoom & Center Controls */}
        <div className="flex flex-col bg-[#F5F2E9]/95 border border-[#806B50]/35 rounded-lg shadow-md overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(Math.round(z) + 1, 19))}
            title={lang === 'fa' ? 'بزرگ‌نمایی' : 'Zoom in'}
            className="p-2.5 text-[#1C1917] hover:bg-[#EBE6DF] transition-colors border-b border-[#806B50]/20 flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(Math.round(z) - 1, 6))}
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

        {apiKey && (
          <button
            type="button"
            onClick={() => setUseSdkEngine((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-lg bg-[#F5F2E9]/95 border border-[#806B50]/35 shadow-sm text-[11px] font-medium text-[#1C1917] hover:bg-white transition-colors w-fit"
          >
            {useSdkEngine
              ? lang === 'fa'
                ? 'موتور نقشه مستقیم'
                : 'Direct Tile Engine'
              : lang === 'fa'
              ? 'موتور SDK گوگل'
              : 'Google JS SDK'}
          </button>
        )}
      </div>

      {/* Coordinate & Active Route Status Bar */}
      <div className="absolute bottom-5 right-5 z-20 hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-lg bg-[#F5F2E9]/95 border border-[#806B50]/35 shadow-md text-xs text-[#57534E]">
        <Compass className="w-4 h-4 text-[#254B36] shrink-0" />
        <span className="font-mono-num">
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
