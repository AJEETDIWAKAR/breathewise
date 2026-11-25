import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mapPlaceToLocationOption } from '../domain/airliveNormalize';
import { PRESET_LOCATIONS } from '../data/previewFixtures';
import {
  fetchAirLivePlaces,
  fetchIndiaRanking,
  type AirLivePlaceDto,
} from '../services/airQualityApi';
import type { AirQualityRankingItem, LocationOption } from '../types/breathewise';

interface UseAirQualityDirectoryOptions {
  location: LocationOption;
  onHydrateLocation: (updater: (prev: LocationOption) => LocationOption) => void;
}

export function useAirQualityDirectory({
  location,
  onHydrateLocation,
}: UseAirQualityDirectoryOptions) {
  const [airLivePlaces, setAirLivePlaces] = useState<AirLivePlaceDto[]>([]);
  const [placesLoading, setPlacesLoading] = useState<boolean>(true);
  const [placesError, setPlacesError] = useState<string | null>(null);

  const [indiaRanking, setIndiaRanking] = useState<AirQualityRankingItem[]>([]);
  const [rankingOrder, setRankingOrderState] = useState<'worst' | 'best'>('worst');
  const [rankingLoading, setRankingLoading] = useState<boolean>(true);
  const [rankingError, setRankingError] = useState<string | null>(null);

  const placesAbortRef = useRef<AbortController | null>(null);
  const rankingAbortRef = useRef<AbortController | null>(null);
  const rankingOrderRef = useRef<'worst' | 'best'>(rankingOrder);

  const loadPlaces = useCallback(() => {
    placesAbortRef.current?.abort();
    const controller = new AbortController();
    placesAbortRef.current = controller;

    fetchAirLivePlaces('IN', { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setAirLivePlaces(res.items);
        setPlacesLoading(false);
        setPlacesError(null);

        if (res.items.length > 0) {
          onHydrateLocation((prev) => {
            const match = res.items.find((p) => p.slug === prev.slug);
            if (!match) return prev;
            const mapped = mapPlaceToLocationOption(match);
            if (
              mapped.name === prev.name &&
              mapped.country === prev.country &&
              mapped.countryName === prev.countryName &&
              mapped.kind === prev.kind &&
              mapped.lat === prev.lat &&
              mapped.lon === prev.lon
            ) {
              return prev;
            }
            return mapped;
          });
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setAirLivePlaces([]);
        setPlacesLoading(false);
        setPlacesError(
          err instanceof Error
            ? err.message
            : 'Unable to load Indian locations directory from AirLive.',
        );
      });
  }, [onHydrateLocation]);

  const loadRanking = useCallback((order: 'worst' | 'best') => {
    rankingAbortRef.current?.abort();
    const controller = new AbortController();
    rankingAbortRef.current = controller;

    fetchIndiaRanking(order, 10, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setIndiaRanking(res.items);
        setRankingLoading(false);
        setRankingError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setIndiaRanking([]);
        setRankingLoading(false);
        setRankingError(
          err instanceof Error ? err.message : 'Unable to load India AQI ranking from AirLive.',
        );
      });
  }, []);

  useEffect(() => {
    loadPlaces();
    return () => {
      placesAbortRef.current?.abort();
    };
  }, [loadPlaces]);

  useEffect(() => {
    rankingOrderRef.current = rankingOrder;
    loadRanking(rankingOrder);
    return () => {
      rankingAbortRef.current?.abort();
    };
  }, [loadRanking, rankingOrder]);

  const setRankingOrder = useCallback((order: 'worst' | 'best') => {
    setRankingLoading(true);
    setRankingError(null);
    setRankingOrderState(order);
  }, []);

  const refreshPlaces = useCallback(() => {
    setPlacesLoading(true);
    setPlacesError(null);
    setRankingLoading(true);
    setRankingError(null);
    loadPlaces();
    loadRanking(rankingOrderRef.current);
  }, [loadPlaces, loadRanking]);

  const availableLocations = useMemo(() => {
    const map = new Map<string, LocationOption>();
    if (airLivePlaces.length > 0) {
      for (const place of airLivePlaces) {
        map.set(place.slug, mapPlaceToLocationOption(place));
      }
    } else {
      for (const preset of PRESET_LOCATIONS) {
        map.set(preset.slug, preset);
      }
    }
    if (!map.has(location.slug)) {
      map.set(location.slug, location);
    }
    return Array.from(map.values());
  }, [airLivePlaces, location]);

  return {
    airLivePlaces,
    placesLoading,
    placesError,
    indiaRanking,
    rankingOrder,
    setRankingOrder,
    rankingLoading,
    rankingError,
    availableLocations,
    refreshPlaces,
  };
}
