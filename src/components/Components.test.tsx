import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import {
  clearDirectFallbackCaches,
  fetchDirectAirLiveCurrent,
  fetchDirectAirLivePlacesByCountry,
  fetchDirectAirLiveRanking,
  fetchDirectOpenMeteoHistory,
  searchDirectAirLiveLocations,
} from '../services/airliveClientFallback';
import {
  ApiClientError,
  fetchAirLivePlaces,
  fetchIndiaRanking,
  fetchLiveCurrentAirQuality,
  fetchLiveHistoryAirQuality,
  searchLocationsApi,
  sendAiChatMessage,
} from '../services/airQualityApi';
import { DEFAULT_FAMILY_PROFILE, PRESET_LOCATIONS } from '../data/previewFixtures';
import { HourlyTrendChart } from './ui/HourlyTrendChart';
import { Modal } from './ui/Modal';

function makeDirectAirLiveMockFetch(options: { includeServerApi?: boolean } = {}) {
  const nowIso = new Date().toISOString();
  const hourStr = nowIso.slice(0, 13) + ':00';

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.startsWith('/api/')) {
      if (!options.includeServerApi) {
        return new Response('<html><body>Not Found</body></html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      return new Response(
        JSON.stringify({ error: { code: 'AQI_PROVIDER_UNAVAILABLE', message: 'Upstream 503', retryable: true } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url === 'https://airlive.tracsa.co.in/api/v1/aqi') {
      return new Response(
        JSON.stringify({
          updated: nowIso,
          count: 2,
          attribution: 'Data: AirLive (https://airlive.tracsa.co.in).',
          items: [
            {
              slug: 'delhi',
              name: 'Delhi',
              kind: 'city',
              country: 'IN',
              countryName: 'India',
              lat: 28.6139,
              lon: 77.209,
              usAqi: 240,
              category: 'Very Unhealthy',
              pm25: 190.2,
              source: 'ground stations',
              stationsUsed: 3,
              updated: nowIso,
            },
            {
              slug: 'noida',
              name: 'Noida',
              kind: 'city',
              country: 'IN',
              countryName: 'India',
              lat: 28.5355,
              lon: 77.391,
              usAqi: 185,
              category: 'Unhealthy',
              pm25: 120.5,
              source: 'ground stations',
              stationsUsed: 2,
              updated: nowIso,
            },
          ],
        }),
        { status: 200 },
      );
    }

    if (url.startsWith('https://airlive.tracsa.co.in/api/v1/aqi/')) {
      const slug = decodeURIComponent(url.split('/').pop() ?? 'delhi');
      return new Response(
        JSON.stringify({
          slug,
          name: slug === 'noida' ? 'Noida' : 'Delhi',
          kind: 'city',
          country: 'IN',
          countryName: 'India',
          lat: slug === 'noida' ? 28.5355 : 28.6139,
          lon: slug === 'noida' ? 77.391 : 77.209,
          usAqi: slug === 'noida' ? 185 : 240,
          category: slug === 'noida' ? 'Unhealthy' : 'Very Unhealthy',
          pm25: slug === 'noida' ? 120.5 : 190.2,
          source: 'ground stations',
          stationsUsed: 3,
          updated: nowIso,
        }),
        { status: 200 },
      );
    }

    if (url.startsWith('https://airlive.tracsa.co.in/api/v1/ranking')) {
      const isBest = url.includes('order=best');
      return new Response(
        JSON.stringify({
          updated: nowIso,
          items: [
            {
              rank: 1,
              slug: isBest ? 'noida' : 'delhi',
              name: isBest ? 'Noida' : 'Delhi',
              kind: 'city',
              country: 'IN',
              countryName: 'India',
              lat: isBest ? 28.5355 : 28.6139,
              lon: isBest ? 77.391 : 77.209,
              usAqi: isBest ? 185 : 240,
              category: isBest ? 'Unhealthy' : 'Very Unhealthy',
              pm25: isBest ? 120.5 : 190.2,
              source: 'ground stations',
              stationsUsed: 3,
              updated: nowIso,
            },
          ],
        }),
        { status: 200 },
      );
    }

    if (url.includes('air-quality-api.open-meteo.com')) {
      return new Response(
        JSON.stringify({
          latitude: 28.61,
          longitude: 77.21,
          hourly: {
            time: [hourStr],
            pm2_5: [120.4],
            pm10: [195.0],
          },
        }),
        { status: 200 },
      );
    }

    return new Response('Not found', { status: 404 });
  });
}

function makeRichServerMockFetch(options: { failCurrentOnce?: boolean } = {}) {
  const nowIso = new Date().toISOString();
  const hourStr = nowIso.slice(0, 13) + ':00';
  let currentCalls = 0;

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/api/air-quality/places')) {
      return new Response(
        JSON.stringify({
          updated: nowIso,
          count: 2,
          attribution: 'Data: AirLive (https://airlive.tracsa.co.in).',
          attributionUrl: 'https://airlive.tracsa.co.in',
          cacheHit: false,
          items: [
            {
              slug: 'delhi',
              name: 'Delhi',
              kind: 'city',
              country: 'IN',
              countryName: 'India',
              lat: 28.6139,
              lon: 77.209,
              usAqi: 262,
              category: 'Very Unhealthy',
              pm25: 212.1,
              source: 'ground stations',
              measurementType: 'ground_station',
              stationsUsed: 3,
              updated: nowIso,
              freshnessStatus: 'fresh',
            },
            {
              slug: 'bengaluru',
              name: 'Bengaluru',
              kind: 'city',
              country: 'IN',
              countryName: 'India',
              lat: 12.9716,
              lon: 77.5946,
              usAqi: 54,
              category: 'Moderate',
              pm25: 13.4,
              source: 'ground stations',
              measurementType: 'ground_station',
              stationsUsed: 4,
              updated: nowIso,
              freshnessStatus: 'fresh',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/air-quality/ranking')) {
      const isBest = url.includes('order=best');
      return new Response(
        JSON.stringify({
          updated: nowIso,
          attribution: 'Data: AirLive (https://airlive.tracsa.co.in).',
          attributionUrl: 'https://airlive.tracsa.co.in',
          cacheHit: false,
          items: [
            {
              rank: 1,
              slug: isBest ? 'bengaluru' : 'delhi',
              name: isBest ? 'Bengaluru' : 'Delhi',
              kind: 'city',
              country: 'IN',
              countryName: 'India',
              lat: isBest ? 12.9716 : 28.6139,
              lon: isBest ? 77.5946 : 77.209,
              usAqi: isBest ? 54 : 262,
              category: isBest ? 'Moderate' : 'Very Unhealthy',
              pm25: isBest ? 13.4 : 212.1,
              source: 'ground stations',
              measurementType: 'ground_station',
              stationsUsed: isBest ? 4 : 3,
              updated: nowIso,
              freshnessStatus: 'fresh',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/air-quality/search')) {
      const parsed = new URL(url, 'http://localhost:3000');
      const q = (parsed.searchParams.get('q') ?? '').toLowerCase();
      const locations = q.includes('empty')
        ? []
        : [
            {
              id: 'bengaluru',
              slug: 'bengaluru',
              name: 'Bengaluru',
              city: 'Bengaluru',
              state: 'India',
              country: 'IN',
              countryName: 'India',
              kind: 'city',
              lat: 12.9716,
              lon: 77.5946,
            },
          ];
      return new Response(JSON.stringify({ locations }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/api/air-quality/current')) {
      currentCalls += 1;
      if (options.failCurrentOnce && currentCalls === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'INVALID_PROVIDER_RESPONSE',
              message: 'AirLive upstream payload invalid',
              retryable: true,
            },
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } },
        );
      }
      const isBlr = url.includes('bengaluru') || url.includes('lat=12.97');
      return new Response(
        JSON.stringify({
          location: {
            id: isBlr ? 'bengaluru' : 'delhi',
            slug: isBlr ? 'bengaluru' : 'delhi',
            name: isBlr ? 'Bengaluru' : 'Delhi',
            city: isBlr ? 'Bengaluru' : 'Delhi',
            state: 'India',
            country: 'IN',
            countryName: 'India',
            kind: 'city',
            lat: isBlr ? 12.9716 : 28.6139,
            lon: isBlr ? 77.5946 : 77.209,
          },
          aqi: {
            value: isBlr ? 54 : 262,
            scale: 'US_AQI',
            category: isBlr ? 'Moderate' : 'Very Unhealthy',
            dominantPollutant: 'PM2.5',
          },
          pollutants: [
            {
              key: 'pm25',
              label: 'PM2.5',
              value: isBlr ? 13.4 : 212.1,
              unit: 'µg/m³',
              subIndex: isBlr ? 54 : 262,
              safeReference: 'WHO 24h: 15 µg/m³ · EPA 24h: 35 µg/m³',
              status: 'measured',
            },
          ],
          provenance: {
            providerId: 'airlive',
            providerName: 'AirLive',
            stationName: isBlr ? 'Bengaluru (4 ground stations)' : 'Delhi (3 ground stations)',
            measurementType: 'ground_station',
            sourceLabel: 'Ground Stations',
            stationsUsed: isBlr ? 4 : 3,
            observedAt: nowIso,
            fetchedAt: nowIso,
            isStale: false,
            freshnessStatus: 'fresh',
            attribution: 'Data: AirLive (https://airlive.tracsa.co.in).',
            attributionUrl: 'https://airlive.tracsa.co.in',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/air-quality/history')) {
      return new Response(
        JSON.stringify({
          hourly: [
            {
              hourLabel: '07:00',
              timestamp: hourStr,
              pm25: 190,
              pm10: 260,
              estimatedNaqi: 241,
              scale: 'US_AQI',
              category: 'Very Unhealthy',
            },
            {
              hourLabel: '14:00',
              timestamp: hourStr,
              pm25: 90,
              pm10: 140,
              estimatedNaqi: 169,
              scale: 'US_AQI',
              category: 'Unhealthy',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response('Not found', { status: 404 });
  });
}

describe('UI Components, Accessibility Focus Traps, Client API Fallback, & Page Flows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearDirectFallbackCaches();
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('traps focus in Modal, closes on backdrop/Escape, and restores focus to trigger', async () => {
    function ModalHarness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Launch Modal
          </button>
          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title="Test Modal"
            description="Modal focus trap check"
            footer={
              <button type="button" onClick={() => setOpen(false)}>
                Confirm Close
              </button>
            }
          >
            <input aria-label="Sample modal input" />
          </Modal>
        </div>
      );
    }

    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Launch Modal' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Test Modal' });
    const closeBtn = within(dialog).getByRole('button', { name: 'Close modal' });
    const confirmBtn = within(dialog).getByRole('button', { name: 'Confirm Close' });

    // Wrap forward Tab from last focusable to first
    confirmBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    // Wrap backward Shift+Tab from first focusable to last
    closeBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmBtn);

    // Escape closes and restores focus to trigger
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);

    // Re-open and test backdrop click close
    fireEvent.click(trigger);
    const presentation = screen.getByRole('dialog').parentElement!;
    fireEvent.click(presentation);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('renders HourlyTrendChart empty state, toggles data table, and navigates points with Arrow/Home/End keys', () => {
    const { rerender } = render(<HourlyTrendChart points={[]} />);
    expect(screen.getByText(/No hourly trend points available/i)).toBeInTheDocument();

    const points = [
      {
        hourLabel: '07:00',
        timestamp: '2026-11-20T07:00:00.000Z',
        pm25: 190,
        pm10: 250,
        estimatedNaqi: 240,
        scale: 'US_AQI' as const,
        category: 'Very Unhealthy' as const,
      },
      {
        hourLabel: '14:00',
        timestamp: '2026-11-20T14:00:00.000Z',
        pm25: 80,
        pm10: 120,
        estimatedNaqi: 164,
        scale: 'US_AQI' as const,
        category: 'Unhealthy' as const,
      },
      {
        hourLabel: '21:00',
        timestamp: '2026-11-20T21:00:00.000Z',
        pm25: 150,
        pm10: 210,
        estimatedNaqi: 205,
        scale: 'US_AQI' as const,
        category: 'Very Unhealthy' as const,
      },
    ];

    rerender(<HourlyTrendChart points={points} scale="US_AQI" caption="Test caption" />);
    expect(screen.getByText('Test caption')).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Show data table/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /Hide data table/i })).toBeInTheDocument();

    const pointButtons = screen.getAllByRole('button', { name: /^Hour /i });
    expect(pointButtons).toHaveLength(3);

    pointButtons[0].focus();
    fireEvent.focus(pointButtons[0]);
    expect(screen.getByText(/US AQI 240/i)).toBeInTheDocument();

    fireEvent.keyDown(pointButtons[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(pointButtons[1]);
    fireEvent.keyDown(pointButtons[1], { key: 'End' });
    expect(document.activeElement).toBe(pointButtons[2]);
    fireEvent.keyDown(pointButtons[2], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(pointButtons[1]);
    fireEvent.keyDown(pointButtons[1], { key: 'Home' });
    expect(document.activeElement).toBe(pointButtons[0]);
    fireEvent.keyDown(pointButtons[0], { key: 'Enter' });
    fireEvent.blur(pointButtons[0]);
  });

  it('exercises airQualityApi direct AirLive CORS fallback, caching, Open-Meteo fallback, offline guard, and AI backend error', async () => {
    // 1. Offline guard
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    await expect(fetchAirLivePlaces('IN')).rejects.toMatchObject({ code: 'OFFLINE' });
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });

    // 2. When /api/* returns 404 HTML, client seamlessly falls back to direct AirLive + Open-Meteo
    vi.stubGlobal('fetch', makeDirectAirLiveMockFetch());
    const places1 = await fetchAirLivePlaces('IN');
    expect(places1.count).toBe(2);
    expect(places1.cacheHit).toBe(false);
    const places2 = await fetchDirectAirLivePlacesByCountry('IN');
    expect(places2.cacheHit).toBe(true);

    const current = await fetchLiveCurrentAirQuality(PRESET_LOCATIONS[0]);
    expect(current.aqi.value).toBe(240);
    expect(current.provenance.providerId).toBe('airlive');

    // Cache hit via direct current
    const currentCached = await fetchDirectAirLiveCurrent({
      ...PRESET_LOCATIONS[0],
      slug: '',
      city: '',
    });
    expect(currentCached.provenance.cacheHit).toBe(true);

    // Coordinate outside 200 km throws LOCATION_NOT_FOUND
    await expect(
      fetchDirectAirLiveCurrent({
        id: 'far',
        slug: '',
        name: 'Far',
        city: '',
        state: '',
        lat: 0,
        lon: 0,
      }),
    ).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });

    const ranking1 = await fetchIndiaRanking('worst', 10);
    expect(ranking1.items[0]?.slug).toBe('delhi');
    const ranking2 = await fetchDirectAirLiveRanking('worst', 10);
    expect(ranking2.cacheHit).toBe(true);

    const searchResults = await searchLocationsApi('noi');
    expect(searchResults.some((l) => l.slug === 'noida')).toBe(true);
    const directSearch = await searchDirectAirLiveLocations('delhi');
    expect(directSearch[0]?.slug).toBe('delhi');

    const history = await fetchLiveHistoryAirQuality(PRESET_LOCATIONS[0]);
    expect(history).toHaveLength(1);
    const directHistory = await fetchDirectOpenMeteoHistory(PRESET_LOCATIONS[0]);
    expect(directHistory).toHaveLength(1);

    // 3. AI chat gives clear server-required error on 404
    await expect(
      sendAiChatMessage({
        message: 'Is Delhi safe?',
        slug: 'delhi',
        history: [],
        familyProfile: DEFAULT_FAMILY_PROFILE,
      }),
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  it('handles AppShell drawer/menus, Overview error/retry/offline/ugm3, AirQuality search/geo/coords/ranking, Family, Impact, and Settings workflows', async () => {
    vi.stubGlobal('fetch', makeRichServerMockFetch({ failCurrentOnce: true }));

    render(<App />);

    // Initial upstream 503 failure shows ErrorMessage and Retry succeeds
    await waitFor(() => {
      expect(screen.getByText(/Upstream AirLive query failed/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Retry check/i }));

    await waitFor(() => {
      expect(screen.getByText(/Delhi/i)).toBeInTheDocument();
    });

    // Recommendation panel action navigates to Indoor/Sustainable/Planner
    const main = screen.getByRole('main');
    const recBtns = within(main).getAllByRole('button', { name: /^Open details for /i });
    fireEvent.click(recBtns[0]);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Indoor Air|Sustainable Choices|Daily Planner/i,
      }),
    ).toBeInTheDocument();

    // AppShell: Notifications bell -> Mark all read; Profile menu -> ArrowDown/Escape; Mobile drawer -> Escape
    const notifBtn = screen.getByRole('button', { name: /Notifications/i });
    fireEvent.click(notifBtn);
    const markAllRead = screen.queryByRole('button', { name: /Mark all read/i });
    if (markAllRead) {
      fireEvent.click(markAllRead);
    }

    const profileBtn = screen.getByRole('button', { name: /Household profile menu/i });
    fireEvent.click(profileBtn);
    const menuItems = screen.getAllByRole('menuitem');
    menuItems[0].focus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(menuItems[1]);
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(menuItems[0]);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(profileBtn);

    const mobileOpenBtn = screen.getByRole('button', { name: /Open navigation menu/i });
    fireEvent.click(mobileOpenBtn);
    expect(screen.getByRole('dialog', { name: /Mobile navigation menu/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Mobile navigation menu/i })).toBeNull();
    });

    // Settings: toggle unit to ugm3, toggle alert checkbox, open & confirm Restore sample demo household
    fireEvent.click(screen.getByRole('button', { name: /^Settings$/i }));
    const unitSelect = await screen.findByLabelText(/Primary metric display/i);
    fireEvent.change(unitSelect, { target: { value: 'ugm3' } });
    const alertCheckbox = screen.getByRole('checkbox', { name: /Enable household threshold notifications/i });
    fireEvent.click(alertCheckbox);
    fireEvent.click(screen.getByRole('button', { name: /Restore sample demo household/i }));
    const resetDialog = await screen.findByRole('dialog', { name: /Restore sample BreatheWise household/i });
    fireEvent.click(within(resetDialog).getByRole('button', { name: /Restore sample data/i }));
    expect(await screen.findByText(/Sample demo household restored/i)).toBeInTheDocument();

    // FamilyPage: validate blank household name & roomAreaSqFt clamping onBlur
    fireEvent.click(screen.getByRole('button', { name: /My Family/i }));
    const householdInput = await screen.findByLabelText(/Household label/i);
    const roomInput = screen.getByLabelText(/Primary bedroom \/ living area/i);
    fireEvent.change(roomInput, { target: { value: '12' } });
    fireEvent.blur(roomInput);
    expect((roomInput as HTMLInputElement).value).toBe('50');

    fireEvent.change(householdInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /Save family profile/i }));
    expect(await screen.findByText(/Enter a household label \(at least 1 character\)/i)).toBeInTheDocument();

    // AirQualityPage: search validation, empty search, successful search, geolocation, manual coords, ranking toggle
    fireEvent.click(screen.getByRole('button', { name: /^Air Quality$/i }));
    const citySearchInput = await screen.findByLabelText(/Search Indian city or locality/i);
    fireEvent.change(citySearchInput, { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('button', { name: /Find location/i }));
    expect(await screen.findByText(/Enter at least 2 characters/i)).toBeInTheDocument();

    fireEvent.change(citySearchInput, { target: { value: 'empty' } });
    fireEvent.click(screen.getByRole('button', { name: /Find location/i }));
    expect(await screen.findByText(/No supported AirLive location matched/i)).toBeInTheDocument();

    fireEvent.change(citySearchInput, { target: { value: 'bengaluru' } });
    fireEvent.click(screen.getByRole('button', { name: /Find location/i }));
    const pickBtn = await screen.findByRole('button', { name: /Bengaluru, India/i });
    fireEvent.click(pickBtn);

    // Geolocation unavailable then success
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });
    fireEvent.click(screen.getByRole('button', { name: /Use device location/i }));
    expect(await screen.findByText(/Browser geolocation is unavailable/i)).toBeInTheDocument();

    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: { latitude: 12.9716, longitude: 77.5946 },
          } as GeolocationPosition),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Use device location/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Use device location/i })).not.toBeDisabled();
    });

    // Manual coordinate validation & match
    fireEvent.click(screen.getByRole('button', { name: /Enter coordinates/i }));
    fireEvent.change(screen.getByLabelText(/Latitude/i), { target: { value: '999' } });
    fireEvent.change(screen.getByLabelText(/Longitude/i), { target: { value: '77.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Match nearest station/i }));
    expect(await screen.findByText(/Enter valid coordinates/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Latitude/i), { target: { value: '12.97' } });
    fireEvent.change(screen.getByLabelText(/Longitude/i), { target: { value: '77.59' } });
    fireEvent.click(screen.getByRole('button', { name: /Match nearest station/i }));
    await waitFor(() => {
      expect(screen.queryByLabelText(/Latitude/i)).toBeNull();
    });

    // Switch ranking to Cleanest Cities
    fireEvent.click(screen.getByRole('button', { name: /Cleanest Cities/i }));
    expect(await screen.findByText(/Cleanest Cities in India Right Now/i)).toBeInTheDocument();

    // ImpactPage: empty habit validation, log household habit, edit modal, methodology modal
    fireEvent.click(screen.getByRole('button', { name: /Environmental Impact/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Add action to tracker/i }));
    expect(
      await screen.findByText(/Please describe the exposure-management or household sustainability action/i),
    ).toBeInTheDocument();

    const habitInput = screen.getByLabelText(/Action description/i);
    fireEvent.change(habitInput, { target: { value: 'Cleaned exhaust fan blades' } });
    fireEvent.click(screen.getByRole('button', { name: /Add action to tracker/i }));
    expect(await screen.findByText('Cleaned exhaust fan blades')).toBeInTheDocument();

    // Edit logged entry
    const editBtn = screen.getByRole('button', { name: /Edit logged action Cleaned exhaust fan blades/i });
    fireEvent.click(editBtn);
    const editModal = await screen.findByRole('dialog', { name: /Edit Logged Action/i });
    const editTitleInput = within(editModal).getByLabelText(/Action title/i);
    fireEvent.change(editTitleInput, { target: { value: 'Cleaned exhaust fan blades thoroughly' } });
    fireEvent.click(within(editModal).getByRole('button', { name: /Save changes/i }));
    expect(await screen.findByText('Cleaned exhaust fan blades thoroughly')).toBeInTheDocument();

    // Open Methodology modal
    fireEvent.click(screen.getByRole('button', { name: /View calculation methodology/i }));
    expect(await screen.findByRole('dialog', { name: /Transparent Calculation Methodology/i })).toBeInTheDocument();
  });

  it('renders OverviewPage offline/backend-unavailable notices and edits transport_shift entries in ImpactModals', async () => {
    // 1. Offline + BACKEND_API_UNAVAILABLE banner & preview switch
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Not found', { status: 404 })),
    );

    render(<App />);
    expect(await screen.findByText(/Offline connection detected/i)).toBeInTheDocument();
    expect(await screen.findByText(/Upstream AirLive query failed/i)).toBeInTheDocument();
    expect(await screen.findByText(/Your device appears to be offline/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Use preview fixture offline/i }));
    expect(await screen.findByText(/Preview Fixture Mode:/i)).toBeInTheDocument();

    // 2. Edit a transport_shift impact log entry so baseline/chosen/distance fields execute
    fireEvent.click(screen.getByRole('button', { name: /Environmental Impact/i }));
    const editShiftBtn = await screen.findByRole('button', {
      name: /Edit logged action Took Metro instead of Petrol Car/i,
    });
    fireEvent.click(editShiftBtn);
    const editDialog = await screen.findByRole('dialog', { name: /Edit Logged Action/i });
    fireEvent.change(within(editDialog).getByLabelText(/Baseline vehicle/i), {
      target: { value: 'diesel_car' },
    });
    fireEvent.change(within(editDialog).getByLabelText(/Chosen mode/i), {
      target: { value: 'walk_cycle' },
    });
    fireEvent.change(within(editDialog).getByLabelText(/Distance \(km\)/i), {
      target: { value: '10' },
    });
    fireEvent.click(within(editDialog).getByRole('button', { name: /Save changes/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Edit Logged Action/i })).toBeNull();
    });
  });
});
