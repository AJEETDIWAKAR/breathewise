import { useCallback, useEffect, useRef, useState } from 'react';
import type { LocationOption } from '../types/breathewise';

export interface UseDeviceGeolocationOptions {
  onResolveCoordinates: (lat: number, lon: number) => Promise<LocationOption>;
  unavailableMessage: string;
  deniedMessage: string;
  notFoundFallbackMessage: string;
  onSuccess?: () => void;
}

export function useDeviceGeolocation({
  onResolveCoordinates,
  unavailableMessage,
  deniedMessage,
  notFoundFallbackMessage,
  onSuccess,
}: UseDeviceGeolocationOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError(unavailableMessage);
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await onResolveCoordinates(pos.coords.latitude, pos.coords.longitude);
          if (mountedRef.current) {
            onSuccess?.();
          }
        } catch (err) {
          if (!mountedRef.current) return;
          setError(err instanceof Error ? err.message : notFoundFallbackMessage);
        } finally {
          if (mountedRef.current) {
            setLoading(false);
          }
        }
      },
      () => {
        if (!mountedRef.current) return;
        setLoading(false);
        setError(deniedMessage);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }, [
    deniedMessage,
    notFoundFallbackMessage,
    onResolveCoordinates,
    onSuccess,
    unavailableMessage,
  ]);

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, setError, clearError, requestLocation };
}
