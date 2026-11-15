import type { PlaceRecord } from '../types';

/** Layer whose polygons are the neighbourhood (mahalle) boundaries. */
export const NEIGHBOURHOOD_LAYER_ID = 'layer-neighbourhoods';

type Ring = [number, number][]; // [lat, lng]

/** Ray-casting point-in-polygon test. */
export function pointInRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Neighbourhoods that have a real boundary (a polygon). */
export function neighbourhoodPolygons(places: PlaceRecord[]): PlaceRecord[] {
  return places.filter((p) => p.layerId === NEIGHBOURHOOD_LAYER_ID && p.geometry?.type === 'Polygon');
}

/** place id -> the neighbourhood whose boundary contains it (places outside every boundary are absent). */
export function buildNeighbourhoodIndex(places: PlaceRecord[]): Record<string, PlaceRecord> {
  const hoods = neighbourhoodPolygons(places);
  const index: Record<string, PlaceRecord> = {};
  if (hoods.length === 0) return index;
  for (const place of places) {
    if (place.layerId === NEIGHBOURHOOD_LAYER_ID || place.geometry) continue;
    const hood = hoods.find((h) => pointInRing(place.latitude, place.longitude, h.geometry!.coordinates));
    if (hood) index[place.id] = hood;
  }
  return index;
}
