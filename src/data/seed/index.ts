// Local demo data for the prototype. These JSON files are the single source of truth
// for the first-run state of the app. Edit them freely; users' own edits live in
// localStorage (see ../localBackend.ts) and can be reset from the admin panel.
//
// Image paths are written relative to the app root ("images/barzok/...") and are
// resolved against Vite's BASE_URL at read time, so the app also works when it is
// served from a sub-path.
import type {
  ContributionRecord,
  EventRecord,
  LayerRecord,
  PersonRecord,
  PlacePersonLink,
  PlaceRecord,
  PlaceStoryLink,
  RouteRecord,
  RouteStopRecord,
  StoryRecord,
} from '../../types';
import layers from './layers.json';
import places from './places.json';
import people from './people.json';
import stories from './stories.json';
import events from './events.json';
import routes from './routes.json';
import routeStops from './routeStops.json';
import placePeople from './placePeople.json';
import placeStories from './placeStories.json';
import contributions from './contributions.json';

export const SEED = {
  layers: layers as unknown as LayerRecord[],
  places: places as unknown as PlaceRecord[],
  people: people as unknown as PersonRecord[],
  stories: stories as unknown as StoryRecord[],
  events: events as unknown as EventRecord[],
  routes: routes as unknown as Omit<RouteRecord, 'stops'>[],
  routeStops: routeStops as unknown as RouteStopRecord[],
  placePeople: placePeople as unknown as PlacePersonLink[],
  placeStories: placeStories as unknown as PlaceStoryLink[],
  contributions: contributions as unknown as ContributionRecord[],
};
