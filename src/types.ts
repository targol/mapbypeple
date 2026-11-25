export type Language = 'fa' | 'en';

export interface PhotoItem {
  url: string;
  captionFa?: string;
  captionEn?: string;
  year?: string;
}

export interface AudioItem {
  url: string;
  titleFa: string;
  titleEn?: string;
  duration?: string;
}

export interface VideoItem {
  url: string;
  titleFa: string;
  titleEn?: string;
}

export interface LayerRecord {
  id: string;
  slug: string;
  nameFa: string;
  nameEn?: string | null;
  descriptionFa?: string | null;
  descriptionEn?: string | null;
  icon: string;
  color: string;
  isVisible: boolean;
  isActive: boolean;
  displayOrder: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

// Lines (water channels, streets) and areas (gardens, neighbourhoods, hills) drawn on the map.
// Coordinates are [lat, lng]. A place without `geometry` is a plain pin.
export interface PlaceGeometry {
  type: 'LineString' | 'Polygon';
  coordinates: [number, number][];
  color?: string;
  fillOpacity?: number;
}

export interface PlaceRecord {
  id: string;
  slug: string;
  /** Optional shape; `latitude`/`longitude` are then a representative point (centroid / middle). */
  geometry?: PlaceGeometry | null;
  /** Neighbourhood chosen by hand; when empty it is worked out from the neighbourhood boundaries. */
  neighbourhoodId?: string | null;
  layerId?: string | null;
  additionalLayerIds: string; // JSON stringified string[]
  nameFa: string;
  nameEn?: string | null;
  category: string;
  shortIntroFa: string;
  shortIntroEn?: string | null;
  fullDescriptionFa: string;
  fullDescriptionEn?: string | null;
  latitude: number;
  longitude: number;
  historicalInfoFa?: string | null;
  historicalInfoEn?: string | null;
  currentStatusFa?: string | null;
  currentStatusEn?: string | null;
  historicalPhotos: string; // JSON stringified PhotoItem[]
  recentPhotos: string; // JSON stringified PhotoItem[]
  audioRecordings: string; // JSON stringified AudioItem[]
  videoLinks: string; // JSON stringified VideoItem[]
  sourceReference?: string | null;
  referenceLinks?: string; // JSON stringified ReferenceItem[]
  documentationDate?: string | null;
  contributorName?: string | null;
  contributorApproved: boolean;
  publicationStatus: 'published' | 'draft' | 'archived';
  verificationStatus: 'verified' | 'community' | 'demo';
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonRecord {
  id: string;
  nameFa: string;
  nameEn?: string | null;
  occupationFa: string;
  occupationEn?: string | null;
  bioFa: string;
  bioEn?: string | null;
  era?: string | null;
  avatarUrl?: string | null;
  sourceReference?: string | null;
  referenceLinks?: string; // JSON stringified ReferenceItem[]
  contributorName?: string | null;
  publicationStatus: string;
  verificationStatus: string;
  isDemo: boolean;
  createdAt: string;
}

export interface StoryRecord {
  id: string;
  slug: string;
  titleFa: string;
  titleEn?: string | null;
  summaryFa: string;
  summaryEn?: string | null;
  contentFa: string;
  contentEn?: string | null;
  narratorName?: string | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
  recordedDate?: string | null;
  sourceReference?: string | null;
  referenceLinks?: string; // JSON stringified ReferenceItem[]
  contributorName?: string | null;
  publicationStatus: string;
  verificationStatus: string;
  isDemo: boolean;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  placeId?: string | null;
  titleFa: string;
  titleEn?: string | null;
  descriptionFa: string;
  descriptionEn?: string | null;
  seasonOrDateFa: string;
  seasonOrDateEn?: string | null;
  eventType: string;
  sourceReference?: string | null;
  referenceLinks?: string; // JSON stringified ReferenceItem[]
  publicationStatus: string;
  verificationStatus: string;
  isDemo: boolean;
}

export interface RouteStopRecord {
  id: string;
  routeId: string;
  placeId: string;
  stopOrder: number;
  noteFa?: string | null;
  noteEn?: string | null;
  audioUrl?: string | null;
}

export interface RouteRecord {
  id: string;
  slug: string;
  titleFa: string;
  titleEn?: string | null;
  descriptionFa: string;
  descriptionEn?: string | null;
  durationMinutes: number;
  distanceKm: number;
  difficulty: string;
  color: string;
  publicationStatus: string;
  verificationStatus: string;
  isDemo: boolean;
  stops: RouteStopRecord[];
  /** Recorded walking track as [lat, lng] points (from a GPX file). Falls back to straight lines between stops. */
  track?: [number, number][];
}

export interface MediaRecord {
  id: string;
  placeId?: string | null;
  storyId?: string | null;
  mediaType: string;
  fileUrl: string;
  titleFa: string;
  titleEn?: string | null;
  captionFa?: string | null;
  captionEn?: string | null;
  captureDate?: string | null;
  photographerOrCreator?: string | null;
  sourceReference?: string | null;
  referenceLinks?: string; // JSON stringified ReferenceItem[]
  publicationStatus: string;
  verificationStatus: string;
  isDemo: boolean;
}

export interface ContributionRecord {
  id: string;
  submissionType: string;
  title: string;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
  mediaUrl?: string | null;
  contributorName: string;
  contactInfo: string;
  consentToPublish: boolean;
  moderationStatus: 'pending_review' | 'approved' | 'rejected' | 'needs_more_info';
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlacePersonLink {
  id: string;
  placeId: string;
  personId: string;
  relationshipRoleFa?: string | null;
}

export interface PlaceStoryLink {
  id: string;
  placeId: string;
  storyId: string;
}

export interface PublicMapBundle {
  layers: LayerRecord[];
  places: PlaceRecord[];
  people: PersonRecord[];
  stories: StoryRecord[];
  events: EventRecord[];
  routes: RouteRecord[];
  placePeople: PlacePersonLink[];
  placeStories: PlaceStoryLink[];
}

export interface AdminBundle extends PublicMapBundle {
  media: MediaRecord[];
  contributions: ContributionRecord[];
}

// Geographic center of Barzok, Kashan County, Isfahan Province, Iran.
// Verified against two independent sources: Wikipedia (33°47′09″N 51°13′38″E =
// 33.78583, 51.22722) and a gazetteer listing (≈33.783, 51.225). The earlier value
// (33.7925, 51.2292) was ~0.7 km north-east of the town.
export const BARZOK_CENTER = {
  lat: 33.78583,
  lng: 51.22722,
  defaultZoom: 15,
};

export type ReferenceKind = 'article' | 'book' | 'website' | 'other';
export interface ReferenceItem {
  title: string;
  url?: string;
  kind: ReferenceKind;
}

export const PLACE_STATUS_OPTIONS = ['فعال', 'نیازمند مرمت', 'تخریب‌شده', 'تغییر کاربری‌یافته'] as const;

export const ORG_TAG_FA = 'مستندسازی: خانه برزک';
