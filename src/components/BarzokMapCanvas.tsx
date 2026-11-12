// Map facade used by App.tsx and AdminDashboard.tsx.
//
// The prototype renders with Leaflet + OpenStreetMap (no API keys, no billing).
// To bring Google Maps back later, add a component implementing BarzokMapCanvasProps
// (the previous implementation is archived in docs/future-google-maps/) and select it here,
// e.g. from an environment variable. Nothing else in the app needs to change.
import React from 'react';
import { LeafletMapCanvas } from './map/LeafletMapCanvas';
import type { BarzokMapCanvasProps } from './map/mapTypes';

export type { BarzokMapCanvasProps } from './map/mapTypes';

export function BarzokMapCanvas(props: BarzokMapCanvasProps) {
  return <LeafletMapCanvas {...props} />;
}
