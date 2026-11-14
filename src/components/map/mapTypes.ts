import type { Language, LayerRecord, PlaceRecord, RouteRecord } from '../../types';

// Contract every map implementation (Leaflet today, Google Maps later) must satisfy.
export interface BarzokMapCanvasProps {
  lang: Language;
  layers: LayerRecord[];
  /** Places currently visible (after layer/search filters). */
  places: PlaceRecord[];
  /** Every place, used to resolve the stops of the active route even when their layer is hidden. */
  allPlaces?: PlaceRecord[];
  activeRoute: RouteRecord | null;
  selectedPlaceId: string | null;
  onSelectPlace: (place: PlaceRecord) => void;
  pickMode?: boolean;
  pickedCoords?: { lat: number; lng: number } | null;
  onPickCoords?: (coords: { lat: number; lng: number }) => void;
  /** Visitor's live GPS position (guided walk). */
  userPosition?: { lat: number; lng: number; accuracy: number } | null;
  /** Shows a "my location" button; called when pressed (should start GPS if it is not running). */
  onLocateMe?: () => void;
  /** Keep the map centred on the visitor while walking. Turned off when the visitor drags the map. */
  followUser?: boolean;
  onFollowChange?: (follow: boolean) => void;
}
