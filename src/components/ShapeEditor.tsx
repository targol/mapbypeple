import React, { useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import { BARZOK_CENTER, PlaceRecord } from '../types';

export type ShapeKind = 'point' | 'line' | 'polygon';
export type LatLng = [number, number];

const TILES = {
  osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap', native: 19 },
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Imagery © Esri',
    native: 19,
  },
};

const vertexIcon = (n: number, color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#fff;border:3px solid ${color};color:#1c1917;font:700 10px/14px sans-serif;text-align:center;box-shadow:0 1px 4px #0006">${n}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

function Clicks({ onAdd }: { onAdd: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onAdd([+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)]) });
  return null;
}

export function centroidOf(kind: ShapeKind, pts: LatLng[]): LatLng | null {
  if (pts.length === 0) return null;
  if (kind === 'line') return pts[Math.floor((pts.length - 1) / 2)];
  const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [+lat.toFixed(6), +lng.toFixed(6)];
}

/**
 * Draw a line (qanat, street) or an area (neighbourhood, garden) by clicking on the map.
 * Drag a numbered vertex to move it; double-click / right-click it to delete.
 */
export function ShapeEditor({
  kind,
  points,
  onChange,
  color,
  places,
  editingId,
  focus,
}: {
  kind: 'line' | 'polygon';
  points: LatLng[];
  onChange: (p: LatLng[]) => void;
  color: string;
  places: PlaceRecord[];
  editingId: string | null;
  focus?: LatLng | null;
}) {
  const [sat, setSat] = useState(false);
  const tiles = sat ? TILES.sat : TILES.osm;
  const center: LatLng = points[0] ?? focus ?? [BARZOK_CENTER.lat, BARZOK_CENTER.lng];
  const others = useMemo(() => places.filter((p) => p.id !== editingId), [places, editingId]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-[#57534E]">
          روی نقشه کلیک کنید تا نقطه اضافه شود. نقطه را بکشید تا جابه‌جا شود؛ دوبار کلیک یا کلیک راست روی نقطه، آن را حذف می‌کند.
        </span>
        <button type="button" onClick={() => setSat((s) => !s)} className="px-2 py-1 rounded bg-white border border-[#806B50]/30">
          {sat ? 'نقشه ساده' : 'ماهواره'}
        </button>
        <button
          type="button"
          disabled={points.length === 0}
          onClick={() => onChange(points.slice(0, -1))}
          className="px-2 py-1 rounded bg-white border border-[#806B50]/30 disabled:opacity-40"
        >
          برگرداندن آخرین نقطه
        </button>
        <button
          type="button"
          disabled={points.length === 0}
          onClick={() => onChange([])}
          className="px-2 py-1 rounded bg-white border border-red-300 text-red-700 disabled:opacity-40"
        >
          پاک کردن همه
        </button>
        <span className="font-mono-num text-[#806B50]">{points.length} نقطه</span>
      </div>
      <div className="h-80 rounded-lg overflow-hidden border border-[#806B50]/30" dir="ltr" data-testid="shape-map">
        <MapContainer center={center} zoom={17} maxZoom={21} className="w-full h-full" doubleClickZoom={false}>
          <TileLayer key={sat ? 's' : 'o'} url={tiles.url} attribution={tiles.attr} maxNativeZoom={tiles.native} maxZoom={21} subdomains="abc" />
          <Clicks onAdd={(p) => onChange([...points, p])} />
          {others.map((p) =>
            p.geometry ? (
              p.geometry.type === 'Polygon' ? (
                <Polygon key={p.id} positions={p.geometry.coordinates} pathOptions={{ color: '#78716C', weight: 1, fillOpacity: 0.05, interactive: false }} />
              ) : (
                <Polyline key={p.id} positions={p.geometry.coordinates} pathOptions={{ color: '#78716C', weight: 2, opacity: 0.6, interactive: false }} />
              )
            ) : (
              <CircleMarker key={p.id} center={[p.latitude, p.longitude]} radius={3} pathOptions={{ color: '#57534E', weight: 1, fillOpacity: 0.7, interactive: false }} />
            )
          )}
          {points.length >= 2 &&
            (kind === 'polygon' && points.length >= 3 ? (
              <Polygon positions={points} pathOptions={{ color, weight: 3, fillColor: color, fillOpacity: 0.25, interactive: false }} />
            ) : (
              <Polyline positions={points} pathOptions={{ color, weight: 4, interactive: false }} />
            ))}
          {points.map((p, i) => (
            <Marker
              key={`${i}-${points.length}`}
              position={p}
              icon={vertexIcon(i + 1, color)}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  onChange(points.map((q, j) => (j === i ? ([+ll.lat.toFixed(6), +ll.lng.toFixed(6)] as LatLng) : q)));
                },
                dblclick: () => onChange(points.filter((_, j) => j !== i)),
                contextmenu: () => onChange(points.filter((_, j) => j !== i)),
              }}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
