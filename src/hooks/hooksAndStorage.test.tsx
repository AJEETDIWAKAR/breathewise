import { useRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FAMILY_PROFILE, PRESET_LOCATIONS } from '../data/previewFixtures';
import { useAutoClearState } from './useAutoClearTimer';
import { useDeviceGeolocation } from './useDeviceGeolocation';
import { useFocusTrap } from './useFocusTrap';
import {
  clearAllAppStorage,
  loadFromStorage,
  loadInitialPersistedState,
  parseFamilyProfileFromStorage,
  saveToStorage,
  STORAGE_KEYS,
} from '../state/storagePersistence';
import {
  clearDirectFallbackCaches,
  fetchDirectAirLiveCurrent,
  fetchDirectAirLivePlacesByCountry,
  fetchDirectAirLiveRanking,
  fetchDirectOpenMeteoHistory,
  fetchWithTimeout,
  searchDirectAirLiveLocations,
} from '../services/airliveClientFallback';
import { createEntryId } from '../utils/id';

function GeoHarness({
  onResolve,
  onSuccess,
}: {
  onResolve: (lat: number, lon: number) => Promise<typeof PRESET_LOCATIONS[0]>;
  onSuccess?: () => void;
}) {
  const { loading, error, clearError, requestLocation } = useDeviceGeolocation({
    onResolveCoordinates: onResolve,
    unavailableMessage: 'Geo unavailable',
    deniedMessage: 'Geo denied',
    notFoundFallbackMessage: 'Geo not found',
    onSuccess,
  });

  return (
    <div>
      <button type="button" onClick={requestLocation}>
        Locate
      </button>
      <button type="button" onClick={clearError}>
        Clear
      </button>
      <span data-testid="geo-loading">{loading ? 'yes' : 'no'}</span>
      <span data-testid="geo-error">{error ?? 'none'}</span>
    </div>
  );
}

function AutoClearHarness({ delay = 1000 }: { delay?: number }) {
  const [val, trigger, clear] = useAutoClearState<string | null>(null, delay);
  return (
    <div>
      <button type="button" onClick={() => trigger('Saved!')}>
        Trigger
      </button>
      <button type="button" onClick={clear}>
        Clear
      </button>
      <span data-testid="auto-val">{val ?? 'empty'}</span>
    </div>
  );
}

function FocusTrapHarness({
  emptyContainer = false,
  allowRestore = true,
  useInitialRef = false,
}: {
  emptyContainer?: boolean;
  allowRestore?: boolean;
  useInitialRef?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [escapedCount, setEscapedCount] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLButtonElement | null>(null);

  useFocusTrap({
    active,
    containerRef,
    initialFocusRef: useInitialRef ? initialFocusRef : undefined,
    onEscape: () => {
      setEscapedCount((c) => c + 1);
      setActive(false);
    },
    restoreFocus: true,
    shouldRestoreFocus: () => allowRestore,
  });

  return (
    <div>
      <button type="button" onClick={() => setActive(true)}>
        Open Trap
      </button>
      <span data-testid="escaped-count">{escapedCount}</span>
      {active && (
        <div ref={containerRef} tabIndex={-1} data-testid="trap-box">
          {!emptyContainer && (
            <>
              <button type="button">First</button>
              <button type="button" hidden>
                Hidden
              </button>
              <button type="button" ref={initialFocusRef}>
                Last
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

describe('useDeviceGeolocation hook', () => {
  const originalGeo = navigator.geolocation;

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeo,
    });
  });

  it('sets unavailable message when geolocation API is absent', () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });
    render(<GeoHarness onResolve={vi.fn()} />);
    fireEvent.click(screen.getByText('Locate'));
    expect(screen.getByTestId('geo-error')).toHaveTextContent('Geo unavailable');
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByTestId('geo-error')).toHaveTextContent('none');
  });

  it('handles resolved coordinates, non-Error rejections, and denied errors cleanly', async () => {
    const onSuccess = vi.fn();
    const onResolve = vi
      .fn()
      .mockResolvedValueOnce(PRESET_LOCATIONS[0])
      .mockRejectedValueOnce('plain-failure');

    let nextMode: 'success' | 'error' = 'success';
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (
          ok: (pos: GeolocationPosition) => void,
          fail: () => void,
        ) => {
          if (nextMode === 'success') {
            ok({ coords: { latitude: 28.61, longitude: 77.2 } } as GeolocationPosition);
          } else {
            fail();
          }
        },
      },
    });

    render(<GeoHarness onResolve={onResolve} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByText('Locate'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('geo-loading')).toHaveTextContent('no');

    // Second call fails with non-Error value -> falls back to notFoundFallbackMessage
    fireEvent.click(screen.getByText('Locate'));
    await waitFor(() => expect(screen.getByTestId('geo-error')).toHaveTextContent('Geo not found'));

    // Third call hits browser geolocation error callback -> deniedMessage
    nextMode = 'error';
    fireEvent.click(screen.getByText('Locate'));
    expect(screen.getByTestId('geo-error')).toHaveTextContent('Geo denied');
  });
});

describe('useAutoClearState and useFocusTrap hooks', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-clears after timeout, re-triggers safely, and supports manual clear', () => {
    vi.useFakeTimers();
    render(<AutoClearHarness delay={500} />);

    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByTestId('auto-val')).toHaveTextContent('Saved!');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Re-trigger resets timer
    fireEvent.click(screen.getByText('Trigger'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('auto-val')).toHaveTextContent('empty');

    fireEvent.click(screen.getByText('Trigger'));
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByTestId('auto-val')).toHaveTextContent('empty');
  });

  it('manages Tab wrapping, Shift+Tab, Escape close, empty container, and focus restoration', async () => {
    vi.useFakeTimers();
    const { rerender } = render(<FocusTrapHarness useInitialRef />);
    const openBtn = screen.getByText('Open Trap');
    openBtn.focus();
    fireEvent.click(openBtn);

    act(() => {
      vi.advanceTimersByTime(5);
    });
    expect(document.activeElement).toBe(screen.getByText('Last'));

    // Tab forward from Last -> wraps to First
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByText('First'));

    // Shift+Tab backward from First -> wraps to Last
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText('Last'));

    // Escape closes and restores focus to Open Trap
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('escaped-count')).toHaveTextContent('1');
    expect(document.activeElement).toBe(openBtn);

    // Empty container falls back to container focus on open and Tab
    rerender(<FocusTrapHarness emptyContainer allowRestore={false} />);
    fireEvent.click(screen.getByText('Open Trap'));
    act(() => {
      vi.advanceTimersByTime(5);
    });
    expect(document.activeElement).toBe(screen.getByTestId('trap-box'));
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('trap-box'));
  });
});

describe('storagePersistence and utility helpers', () => {
  it('loads, validates, saves, clears storage and tolerates storage errors', () => {
    window.localStorage.clear();
    expect(loadFromStorage('missing', parseFamilyProfileFromStorage, DEFAULT_FAMILY_PROFILE)).toEqual(
      DEFAULT_FAMILY_PROFILE,
    );

    window.localStorage.setItem(STORAGE_KEYS.profile, '{bad-json');
    expect(
      loadFromStorage(STORAGE_KEYS.profile, parseFamilyProfileFromStorage, DEFAULT_FAMILY_PROFILE),
    ).toEqual(DEFAULT_FAMILY_PROFILE);

    window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify({ householdName: '' }));
    expect(parseFamilyProfileFromStorage({ householdName: '' })).toBeNull();

    saveToStorage(STORAGE_KEYS.profile, DEFAULT_FAMILY_PROFILE);
    const loaded = loadInitialPersistedState({
      location: PRESET_LOCATIONS[0],
      settings: { dataModePreference: 'live', preferredUnit: 'aqi', enableThresholdAlerts: true },
      profile: DEFAULT_FAMILY_PROFILE,
      impactLogs: [],
    });
    expect(loaded.familyProfile.householdName).toBe(DEFAULT_FAMILY_PROFILE.householdName);

    clearAllAppStorage();
    expect(window.localStorage.getItem(STORAGE_KEYS.profile)).toBeNull();

    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveToStorage('k', { a: 1 })).not.toThrow();
    setSpy.mockRestore();

    expect(createEntryId('test')).toMatch(/^test-/);
  });
});

describe('airliveClientFallback edge paths', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearDirectFallbackCaches();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('handles offline, aborted, timeout, and network error cases in fetchWithTimeout', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await expect(fetchWithTimeout('/api/health')).rejects.toMatchObject({ code: 'OFFLINE' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

    const preAborted = new AbortController();
    preAborted.abort();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    await expect(fetchWithTimeout('/api/health', { signal: preAborted.signal })).rejects.toThrow();

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('network down'));
    await expect(fetchWithTimeout('/api/health')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('serves direct AirLive fallback responses, caches, and maps HTTP/validation failures', async () => {
    const freshIso = new Date().toISOString();
    const rawPlace = {
      slug: 'delhi',
      name: 'Delhi',
      kind: 'city',
      country: 'IN',
      countryName: 'India',
      lat: 28.6139,
      lon: 77.209,
      usAqi: 185,
      category: 'Unhealthy',
      pm25: 112.4,
      source: 'ground stations',
      stationsUsed: 4,
      updated: freshIso,
      url: 'https://airlive.tracsa.co.in/delhi',
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ updated: freshIso, items: [rawPlace] }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(rawPlace), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ updated: freshIso, items: [{ ...rawPlace, rank: 1 }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response('Server down', { status: 503 }));

    const places = await fetchDirectAirLivePlacesByCountry('IN');
    expect(places.count).toBe(1);
    expect(places.cacheHit).toBe(false);

    // Coordinate-only lookup uses cached places directory + fetches current place
    const coordLoc = { ...PRESET_LOCATIONS[0], slug: '', city: 'Delhi' };
    const reading = await fetchDirectAirLiveCurrent(coordLoc);
    expect(reading.location.slug).toBe('delhi');
    expect(reading.provenance.cacheHit).toBe(false);

    // Second call uses directCurrentCache
    const cachedReading = await fetchDirectAirLiveCurrent(coordLoc);
    expect(cachedReading.provenance.cacheHit).toBe(true);

    // Search uses cached places
    const searched = await searchDirectAirLiveLocations('Del');
    expect(searched.length).toBe(1);

    // Ranking fetch + cache hit
    const ranking1 = await fetchDirectAirLiveRanking('worst', 10);
    const ranking2 = await fetchDirectAirLiveRanking('worst', 10);
    expect(ranking1.cacheHit).toBe(false);
    expect(ranking2.cacheHit).toBe(true);

    // Open-Meteo non-OK returns empty array cleanly
    const omEmpty = await fetchDirectOpenMeteoHistory(PRESET_LOCATIONS[0]);
    expect(omEmpty).toEqual([]);
    expect(fetchSpy).toHaveBeenCalled();

    // Invalid slug throws VALIDATION_ERROR
    await expect(
      fetchDirectAirLiveCurrent({ ...PRESET_LOCATIONS[0], slug: 'invalid slug!' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
