import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// Users table for Firebase Authentication & Administrator RBAC
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('admin').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 1. Thematic Layers (dynamically managed in Admin Panel)
export const layers = pgTable(
  'layers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    nameFa: text('name_fa').notNull(),
    nameEn: text('name_en'),
    descriptionFa: text('description_fa'),
    descriptionEn: text('description_en'),
    icon: text('icon').default('landmark').notNull(),
    color: text('color').default('#254B36').notNull(),
    isVisible: boolean('is_visible').default(true).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('layers_order_idx').on(table.displayOrder)]
);

// 2. Places / Locations on the Barzok Map
export const places = pgTable(
  'places',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    layerId: uuid('layer_id').references(() => layers.id, { onDelete: 'set null' }),
    additionalLayerIds: text('additional_layer_ids').default('[]').notNull(),
    nameFa: text('name_fa').notNull(),
    nameEn: text('name_en'),
    category: text('category').notNull(),
    shortIntroFa: text('short_intro_fa').notNull(),
    shortIntroEn: text('short_intro_en'),
    fullDescriptionFa: text('full_description_fa').notNull(),
    fullDescriptionEn: text('full_description_en'),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    historicalInfoFa: text('historical_info_fa'),
    historicalInfoEn: text('historical_info_en'),
    currentStatusFa: text('current_status_fa'),
    currentStatusEn: text('current_status_en'),
    historicalPhotos: text('historical_photos').default('[]').notNull(),
    recentPhotos: text('recent_photos').default('[]').notNull(),
    audioRecordings: text('audio_recordings').default('[]').notNull(),
    videoLinks: text('video_links').default('[]').notNull(),
    sourceReference: text('source_reference'),
    documentationDate: text('documentation_date'),
    contributorName: text('contributor_name'),
    contributorApproved: boolean('contributor_approved').default(false).notNull(),
    publicationStatus: text('publication_status').default('published').notNull(),
    verificationStatus: text('verification_status').default('demo').notNull(),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('places_coords_idx').on(table.latitude, table.longitude),
    index('places_layer_idx').on(table.layerId),
    index('places_status_idx').on(table.publicationStatus),
  ]
);

// 3. People & Local Occupations
export const people = pgTable('people', {
  id: uuid('id').defaultRandom().primaryKey(),
  nameFa: text('name_fa').notNull(),
  nameEn: text('name_en'),
  occupationFa: text('occupation_fa').notNull(),
  occupationEn: text('occupation_en'),
  bioFa: text('bio_fa').notNull(),
  bioEn: text('bio_en'),
  era: text('era'),
  avatarUrl: text('avatar_url'),
  sourceReference: text('source_reference'),
  contributorName: text('contributor_name'),
  publicationStatus: text('publication_status').default('published').notNull(),
  verificationStatus: text('verification_status').default('demo').notNull(),
  isDemo: boolean('is_demo').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Stories, Oral Histories & Memories
export const stories = pgTable('stories', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  titleFa: text('title_fa').notNull(),
  titleEn: text('title_en'),
  summaryFa: text('summary_fa').notNull(),
  summaryEn: text('summary_en'),
  contentFa: text('content_fa').notNull(),
  contentEn: text('content_en'),
  narratorName: text('narrator_name'),
  audioUrl: text('audio_url'),
  imageUrl: text('image_url'),
  recordedDate: text('recorded_date'),
  sourceReference: text('source_reference'),
  contributorName: text('contributor_name'),
  publicationStatus: text('publication_status').default('published').notNull(),
  verificationStatus: text('verification_status').default('demo').notNull(),
  isDemo: boolean('is_demo').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. Archival Media & Photographs Metadata
export const media = pgTable('media', {
  id: uuid('id').defaultRandom().primaryKey(),
  placeId: uuid('place_id').references(() => places.id, { onDelete: 'set null' }),
  storyId: uuid('story_id').references(() => stories.id, { onDelete: 'set null' }),
  mediaType: text('media_type').notNull(),
  fileUrl: text('file_url').notNull(),
  titleFa: text('title_fa').notNull(),
  titleEn: text('title_en'),
  captionFa: text('caption_fa'),
  captionEn: text('caption_en'),
  captureDate: text('capture_date'),
  photographerOrCreator: text('photographer_or_creator'),
  sourceReference: text('source_reference'),
  contributorName: text('contributor_name'),
  publicationStatus: text('publication_status').default('published').notNull(),
  verificationStatus: text('verification_status').default('demo').notNull(),
  isDemo: boolean('is_demo').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6. Cultural Events & Seasonal Rituals
export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  placeId: uuid('place_id').references(() => places.id, { onDelete: 'set null' }),
  titleFa: text('title_fa').notNull(),
  titleEn: text('title_en'),
  descriptionFa: text('description_fa').notNull(),
  descriptionEn: text('description_en'),
  seasonOrDateFa: text('season_or_date_fa').notNull(),
  seasonOrDateEn: text('season_or_date_en'),
  eventType: text('event_type').default('ritual').notNull(),
  sourceReference: text('source_reference'),
  contributorName: text('contributor_name'),
  publicationStatus: text('publication_status').default('published').notNull(),
  verificationStatus: text('verification_status').default('demo').notNull(),
  isDemo: boolean('is_demo').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. Traditional Activities & Living Crafts
export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  placeId: uuid('place_id').references(() => places.id, { onDelete: 'set null' }),
  titleFa: text('title_fa').notNull(),
  titleEn: text('title_en'),
  descriptionFa: text('description_fa').notNull(),
  descriptionEn: text('description_en'),
  category: text('category').notNull(),
  publicationStatus: text('publication_status').default('published').notNull(),
  verificationStatus: text('verification_status').default('demo').notNull(),
  isDemo: boolean('is_demo').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. Walking & Storytelling Routes
export const routes = pgTable('routes', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  titleFa: text('title_fa').notNull(),
  titleEn: text('title_en'),
  descriptionFa: text('description_fa').notNull(),
  descriptionEn: text('description_en'),
  durationMinutes: integer('duration_minutes').default(60).notNull(),
  distanceKm: doublePrecision('distance_km').default(1.5).notNull(),
  difficulty: text('difficulty').default('easy').notNull(),
  color: text('color').default('#D6A83F').notNull(),
  publicationStatus: text('publication_status').default('published').notNull(),
  verificationStatus: text('verification_status').default('demo').notNull(),
  isDemo: boolean('is_demo').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 9. Route Stops
export const routeStops = pgTable('route_stops', {
  id: uuid('id').defaultRandom().primaryKey(),
  routeId: uuid('route_id')
    .references(() => routes.id, { onDelete: 'cascade' })
    .notNull(),
  placeId: uuid('place_id')
    .references(() => places.id, { onDelete: 'cascade' })
    .notNull(),
  stopOrder: integer('stop_order').default(1).notNull(),
  noteFa: text('note_fa'),
  noteEn: text('note_en'),
  audioUrl: text('audio_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Public Community Contributions (Moderation Queue)
export const contributions = pgTable(
  'contributions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    submissionType: text('submission_type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    mediaUrl: text('media_url'),
    contributorName: text('contributor_name').notNull(),
    contactInfo: text('contact_info').notNull(),
    consentToPublish: boolean('consent_to_publish').default(false).notNull(),
    moderationStatus: text('moderation_status').default('pending_review').notNull(),
    adminNotes: text('admin_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('contributions_status_idx').on(table.moderationStatus)]
);

// 11. Join Table: Place <-> People
export const placePeople = pgTable('place_people', {
  id: uuid('id').defaultRandom().primaryKey(),
  placeId: uuid('place_id')
    .references(() => places.id, { onDelete: 'cascade' })
    .notNull(),
  personId: uuid('person_id')
    .references(() => people.id, { onDelete: 'cascade' })
    .notNull(),
  relationshipRoleFa: text('relationship_role_fa'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Join Table: Place <-> Stories
export const placeStories = pgTable('place_stories', {
  id: uuid('id').defaultRandom().primaryKey(),
  placeId: uuid('place_id')
    .references(() => places.id, { onDelete: 'cascade' })
    .notNull(),
  storyId: uuid('story_id')
    .references(() => stories.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const layersRelations = relations(layers, ({ many }) => ({
  places: many(places),
}));

export const placesRelations = relations(places, ({ one, many }) => ({
  layer: one(layers, {
    fields: [places.layerId],
    references: [layers.id],
  }),
  placePeople: many(placePeople),
  placeStories: many(placeStories),
  events: many(events),
  media: many(media),
  activities: many(activities),
  routeStops: many(routeStops),
}));

export const peopleRelations = relations(people, ({ many }) => ({
  placePeople: many(placePeople),
}));

export const storiesRelations = relations(stories, ({ many }) => ({
  placeStories: many(placeStories),
  media: many(media),
}));

export const routesRelations = relations(routes, ({ many }) => ({
  stops: many(routeStops),
}));

export const routeStopsRelations = relations(routeStops, ({ one }) => ({
  route: one(routes, {
    fields: [routeStops.routeId],
    references: [routes.id],
  }),
  place: one(places, {
    fields: [routeStops.placeId],
    references: [places.id],
  }),
}));

export const placePeopleRelations = relations(placePeople, ({ one }) => ({
  place: one(places, {
    fields: [placePeople.placeId],
    references: [places.id],
  }),
  person: one(people, {
    fields: [placePeople.personId],
    references: [people.id],
  }),
}));

export const placeStoriesRelations = relations(placeStories, ({ one }) => ({
  place: one(places, {
    fields: [placeStories.placeId],
    references: [places.id],
  }),
  story: one(stories, {
    fields: [placeStories.storyId],
    references: [stories.id],
  }),
}));
