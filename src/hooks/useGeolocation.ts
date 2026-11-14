import { useCallback, useEffect, useRef, useState } from 'react';

export type GeoStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error';

export interface GeoPosition {
  lat: number;
  lng: number;
  /** Radius of uncertainty in metres. */
  accuracy: number;
  timestamp: number;
}

/**
 * Live GPS position from the browser (free, no API key). It only starts after start() is called,
 * because browsers must ask the visitor for permission, and it needs HTTPS (or localhost).
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
    setStatus('idle');
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    if (watchId.current !== null) return; // already watching
    setStatus('requesting');
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setStatus('active');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          // Permission refused (or blocked by an iframe without allow="geolocation").
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
          setStatus('denied');
        } else {
          // Position temporarily unavailable / timeout: keep watching, it usually recovers.
          setStatus((prev) => (prev === 'active' ? prev : 'error'));
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }, []);

  useEffect(
    () => () => {
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    },
    []
  );

  return { status, position, start, stop };
}
