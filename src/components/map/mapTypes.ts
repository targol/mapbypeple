import type { Language, LayerRecord, PlaceRecord, RouteRecord } from '../../types';

// Contract every map implementation (Leaflet today, Google Maps later) must satisfy.
export interface BarzokMapCanvasProps {
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
