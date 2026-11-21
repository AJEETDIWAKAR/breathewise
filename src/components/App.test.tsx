import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiClientError, fetchLiveCurrentAirQuality, sendAiChatMessage } from '../services/airQualityApi';
import { DEFAULT_FAMILY_PROFILE } from '../data/previewFixtures';
import App from '../App';

function createMockFetch() {
  const freshIso = new Date().toISOString();
  const staleIso = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/api/air-quality/places')) {
      return new Response(
        JSON.stringify({
          updated: freshIso,
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
              updated: freshIso,
              freshnessStatus: 'fresh',
            },
            {
              slug: 'anand-vihar-delhi',
              name: 'Anand Vihar',
              kind: 'locality',
              country: 'IN',
              countryName: 'India',
              lat: 28.6469,
              lon: 77.3164,
              usAqi: 175,
              category: 'Unhealthy',
              pm25: null,
              source: 'atmospheric model',
              measurementType: 'modeled_forecast',
              stationsUsed: null,
              updated: staleIso,
              freshnessStatus: 'stale',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/air-quality/current')) {
      if (url.includes('city=Nearest')) {
        return new Response(
          JSON.stringify({ error: { code: 'LOCATION_NOT_FOUND', message: 'Dummy city sent' } }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      }
      const isAnand = url.includes('slug=anand-vihar-delhi');
      return new Response(
        JSON.stringify(
          isAnand
            ? {
                location: {
                  id: 'anand-vihar-delhi',
                  slug: 'anand-vihar-delhi',
                  name: 'Anand Vihar',
                  city: 'Anand Vihar',
                  state: 'India',
                  country: 'IN',
                  countryName: 'India',
                  kind: 'locality',
                  lat: 28.6469,
                  lon: 77.3164,
                },
                aqi: {
                  value: 175,
                  scale: 'US_AQI',
                  category: 'Unhealthy',
                  dominantPollutant: 'Unavailable',
                },
                pollutants: [
                  {
                    key: 'pm25',
                    label: 'PM2.5',
                    value: null,
                    unit: 'µg/m³',
                    subIndex: null,
                    safeReference: 'WHO 24h: 15 µg/m³ · EPA 24h: 35 µg/m³',
                    status: 'unavailable',
                  },
                ],
                missingPollutants: ['pm25'],
                provenance: {
                  providerId: 'airlive',
                  providerName: 'AirLive',
                  stationName: 'Anand Vihar (Atmospheric model estimate)',
                  measurementType: 'modeled_forecast',
                  sourceLabel: 'Atmospheric Model (Model-based estimate)',
                  stationsUsed: null,
                  observedAt: staleIso,
                  fetchedAt: freshIso,
                  isStale: true,
                  freshnessStatus: 'stale',
                  staleReason: 'Reading is approximately 5 hour(s) old.',
                  attribution: 'Data: AirLive (https://airlive.tracsa.co.in).',
                  attributionUrl: 'https://airlive.tracsa.co.in',
                  cacheHit: false,
                },
              }
            : {
                location: {
                  id: 'delhi',
                  slug: 'delhi',
                  name: 'Delhi',
                  city: 'Delhi',
                  state: 'India',
                  country: 'IN',
                  countryName: 'India',
                  kind: 'city',
                  lat: 28.6139,
                  lon: 77.209,
                },
                aqi: {
                  value: 262,
                  scale: 'US_AQI',
                  category: 'Very Unhealthy',
                  dominantPollutant: 'PM2.5',
                },
                pollutants: [
                  {
                    key: 'pm25',
                    label: 'PM2.5',
                    value: 212.1,
                    unit: 'µg/m³',
                    subIndex: 262,
                    safeReference: 'WHO 24h: 15 µg/m³ · EPA 24h: 35 µg/m³',
                    status: 'measured',
                  },
                ],
                missingPollutants: [],
                provenance: {
                  providerId: 'airlive',
                  providerName: 'AirLive',
                  stationName: 'Delhi (3 ground stations)',
                  measurementType: 'ground_station',
                  sourceLabel: 'Ground Stations',
                  stationsUsed: 3,
                  observedAt: freshIso,
                  fetchedAt: freshIso,
                  isStale: false,
                  freshnessStatus: 'fresh',
                  attribution: 'Data: AirLive (https://airlive.tracsa.co.in).',
                  attributionUrl: 'https://airlive.tracsa.co.in',
                  cacheHit: false,
                },
              },
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/air-quality/ranking')) {
      return new Response(
        JSON.stringify({
          updated: freshIso,
          attribution: 'Data: AirLive (https://airlive.tracsa.co.in).',
          attributionUrl: 'https://airlive.tracsa.co.in',
          cacheHit: false,
          items: [
            {
              rank: 1,
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
              updated: freshIso,
              freshnessStatus: 'fresh',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/air-quality/history')) {
      return new Response(
        JSON.stringify({
          location: { lat: 28.6139, lon: 77.209, timezone: 'Asia/Kolkata (IST)' },
          hourly: [
            {
              hourLabel: '08:00',
              timestamp: freshIso,
              pm25: 212.1,
              pm10: 290,
              estimatedNaqi: 262,
              category: 'Very Unhealthy',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/air-quality/search')) {
      return new Response(
        JSON.stringify({
          locations: [
            {
              id: 'anand-vihar-delhi',
              slug: 'anand-vihar-delhi',
              name: 'Anand Vihar',
              city: 'Anand Vihar',
              state: 'India',
              country: 'IN',
              countryName: 'India',
              kind: 'locality',
              lat: 28.6469,
              lon: 77.3164,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/ai/chat') && init?.method === 'POST') {
      const parsedBody = init.body ? (JSON.parse(String(init.body)) as { message?: string }) : {};
      const isFallbackQuery = parsedBody.message?.toLowerCase().includes('fallback');
      return new Response(
        JSON.stringify({
          reply: 'Based on Delhi live US AQI 262 (Very Unhealthy, PM2.5 212.1 µg/m³), stay indoors.',
          model: isFallbackQuery ? 'rule-based-fallback' : 'gemini-3.1-flash-lite',
          responseSource: isFallbackQuery ? 'rule_based_fallback' : 'gemini',
          aiAvailable: !isFallbackQuery,
          ...(isFallbackQuery
            ? {
                fallbackReasonCode: 'QUOTA_EXHAUSTED',
                aiUnavailableReason:
                  'Gemini AI is temporarily unavailable due to API quota exhaustion (HTTP 429).',
              }
            : {}),
          liveDataAvailable: true,
          structured: {
            summary:
              'Based on Delhi live US AQI 262 (Very Unhealthy, PM2.5 212.1 µg/m³), stay indoors.',
            currentAirQualityContext: {
              locationName: 'Delhi, India',
              aqiSummary: 'US AQI 262 (Very Unhealthy) · Ground Stations (3 stations)',
              measuredFacts: ['US EPA AQI: 262', 'PM2.5: 212.1 µg/m³'],
              missingData: ['PM10 and trace gases are not emitted by this endpoint'],
            },
            recommendations: [
              {
                title: 'Pause outdoor exertion',
                action: 'Keep children and seniors indoors and wear N95 outside.',
                outcomeCategory: 'reduce_personal_exposure',
                outcomeLabel: 'Reduces Personal Exposure',
                estimatedCostOrBudgetNote: '₹0–₹100 mask',
              },
              {
                title: 'Wet-mop floors',
                action: 'Damp-clean indoor dust rather than dry sweeping.',
                outcomeCategory: 'improve_indoor_air',
                outcomeLabel: 'Improves Indoor Air Conditions',
                estimatedCostOrBudgetNote: '₹0',
              },
              {
                title: 'Prefer Metro rail',
                action: 'Reduces personal commute emissions without claiming city AQI impact.',
                outcomeCategory: 'reduce_personal_emissions',
                outcomeLabel: 'Reduces Personal Emissions',
                estimatedCostOrBudgetNote: 'Saves fuel spend',
              },
            ],
            explanation:
              'Personal exposure, indoor air, and personal emissions are three separate outcomes.',
            precautions: ['Not medical advice; keep asthma medications accessible.'],
            confidenceAndLimitations: {
              confidenceLevel: 'high',
              notes: 'Grounded in 3 AirLive ground stations.',
            },
            sources: [
              {
                name: 'AirLive',
                detail: 'Ground Stations (3)',
                url: 'https://airlive.tracsa.co.in',
              },
            ],
            dataFreshness: 'Fresh (updated recently)',
          },
          groundedReading: {
            locationName: 'Delhi',
            slug: 'delhi',
            usAqi: 262,
            category: 'Very Unhealthy',
            pm25: 212.1,
            sourceLabel: 'Ground Stations',
            stationsUsed: 3,
            observedAt: freshIso,
            freshnessStatus: 'fresh',
            attributionUrl: 'https://airlive.tracsa.co.in',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

describe('BreatheWise AirLive + Gemini UI Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', createMockFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders live AirLive US AQI, PM2.5, Ground Stations, Freshness badge, clickable attribution, and Settings mode switch', async () => {
    render(<App />);

    expect(screen.getByRole('status', { name: /Loading air quality information/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('aqi-value')).toHaveTextContent('262');
    });
    expect(screen.getByTestId('pm25-value')).toHaveTextContent('212.1 µg/m³');
    expect(screen.getByTestId('freshness-badge')).toHaveTextContent('Fresh');
    expect(screen.getByText(/Ground Stations \(3 stations\)/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Data by AirLive/i })).toHaveAttribute(
      'href',
      'https://airlive.tracsa.co.in',
    );
    expect(screen.queryByRole('group', { name: /Inspect dashboard data states/i })).not.toBeInTheDocument();

    // Switch to Preview Fixture Mode via Settings and verify Overview disclosure + switch back
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' });
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Settings' }));
    const modeSelect = await screen.findByLabelText('Data source mode');
    fireEvent.change(modeSelect, { target: { value: 'preview' } });

    fireEvent.click(within(mainNav).getByRole('button', { name: 'Overview' }));
    expect(await screen.findByText(/Preview Fixture Mode:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Switch to Live AirLive/i }));
    await waitFor(() => {
      expect(screen.getByTestId('aqi-value')).toHaveTextContent('262');
    });
  });

  it('supports searchable header location selector switching to a stale model-based location with null PM2.5', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('aqi-value')).toHaveTextContent('262');
    });

    fireEvent.click(screen.getByRole('button', { name: /Select monitoring location/i }));
    const locSearch = screen.getByLabelText('Search Indian locations');
    fireEvent.change(locSearch, { target: { value: 'Anand' } });

    const optionBtn = await screen.findByRole('option', { name: /Anand Vihar/i });
    fireEvent.click(optionBtn);

    await waitFor(() => {
      expect(screen.getByTestId('aqi-value')).toHaveTextContent('175');
    });
    expect(screen.getByTestId('pm25-value')).toHaveTextContent('Unavailable');
    expect(screen.getByTestId('freshness-badge')).toHaveTextContent('Stale (>3h)');
    expect(screen.getByText(/Model-based estimate \(no local ground station\)/i)).toBeInTheDocument();
  });

  it('navigates all 9 pages, validates empty/long assistant inputs, and renders structured Gemini + fallback responses', async () => {
    render(<App />);
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' });
    const pages = [
      'Air Quality',
      'AI Assistant',
      'My Family',
      'Daily Planner',
      'Indoor Air',
      'Sustainable Choices',
      'Environmental Impact',
      'Settings',
      'Overview',
    ];

    for (const label of pages) {
      fireEvent.click(within(mainNav).getByRole('button', { name: label }));
      expect(await screen.findByRole('heading', { level: 1, name: label })).toBeInTheDocument();
    }

    fireEvent.click(within(mainNav).getByRole('button', { name: 'Air Quality' }));
    expect(await screen.findByText(/Most Polluted Cities in India Right Now/i)).toBeInTheDocument();

    fireEvent.click(within(mainNav).getByRole('button', { name: 'AI Assistant' }));
    const chatInput = await screen.findByLabelText('Ask an air quality question');
    const sendBtn = screen.getByRole('button', { name: /^Send$/i });

    // Empty input validation
    fireEvent.click(sendBtn);
    expect(screen.getByRole('alert')).toHaveTextContent(/Please enter a question/i);

    // Over-length input validation
    fireEvent.change(chatInput, { target: { value: 'a'.repeat(1005) } });
    fireEvent.click(sendBtn);
    expect(screen.getByRole('alert')).toHaveTextContent(/Question is too long/i);

    // Valid structured Gemini query
    fireEvent.change(chatInput, { target: { value: 'Is it safe to jog outside today?' } });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Based on Delhi live US AQI 262 \(Very Unhealthy, PM2\.5 212\.1 µg\/m³\)/i),
      ).toBeInTheDocument();
    });
    const chatLog = screen.getByRole('log', { name: /Assistant conversation/i });
    expect(within(chatLog).getByText(/Gemini \(gemini-3\.1-flash-lite\)/i)).toBeInTheDocument();
    expect(within(chatLog).getByText('Personal Exposure')).toBeInTheDocument();
    expect(within(chatLog).getByText('Indoor Air')).toBeInTheDocument();
    expect(within(chatLog).getByText('Personal Emissions')).toBeInTheDocument();

    // Rule-based fallback display when Gemini is unavailable
    fireEvent.change(chatInput, { target: { value: 'Trigger fallback test' } });
    fireEvent.click(sendBtn);
    await waitFor(() => {
      expect(within(chatLog).getByText(/Rule-Based Fallback \(AI Unavailable\)/i)).toBeInTheDocument();
    });
    expect(within(chatLog).getByRole('button', { name: /Retry with Gemini/i })).toBeInTheDocument();
  });

  it('supports end-to-end Modules A-D flow: profile save -> planner -> indoor -> sustainable -> impact add/edit/remove', async () => {
    render(<App />);
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' });

    // 1. Update Family Profile (Module A)
    fireEvent.click(within(mainNav).getByRole('button', { name: 'My Family' }));
    const householdInput = await screen.findByLabelText('Household label');
    fireEvent.change(householdInput, { target: { value: 'Patel Family' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Family Profile/i }));
    expect(screen.getByText(/Profile saved locally/i)).toBeInTheDocument();

    // 2. Navigate to Daily Planner and verify personalized header & 6 fields
    fireEvent.click(screen.getByRole('button', { name: /View Personalized Daily Plan/i }));
    expect((await screen.findAllByText('Patel Family')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Data or guidance behind it/i).length).toBe(4);
    expect(screen.getAllByText(/Limitations/i).length).toBeGreaterThanOrEqual(4);

    // 3. Navigate to Indoor Air (Module B) and verify 7 topics + evidence boundaries + Mark done
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Indoor Air' }));
    expect(await screen.findByText(/7-Area Household Indoor Air Guide/i)).toBeInTheDocument();
    expect(screen.getByText(/Houseplants do not meaningfully replace air filtration/i)).toBeInTheDocument();
    expect(screen.getByText(/Never burn incense, dhoop, candles, or coils/i)).toBeInTheDocument();
    const markDoneButtons = screen.getAllByRole('button', { name: /Mark done/i });
    fireEvent.click(markDoneButtons[0]);

    // 4. Navigate to Sustainable Choices (Module C) and log an alternative
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Sustainable Choices' }));
    expect(await screen.findByText(/Sustainable Household & Mobility Alternatives/i)).toBeInTheDocument();
    const logChoiceButtons = screen.getAllByRole('button', { name: /Log this action/i });
    fireEvent.click(logChoiceButtons[0]);
    expect(screen.getByText(/Logged to tracker/i)).toBeInTheDocument();

    // 5. Navigate to Environmental Impact (Module D): verify 3 pillars, add, edit, remove
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Environmental Impact' }));
    expect((await screen.findAllByText(/A\. Personal Emissions Avoided/i)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/B\. Exposure-Management Actions/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/C\. Household Sustainability Progress/i).length).toBeGreaterThanOrEqual(1);

    // Add an exposure/household action
    const habitInput = screen.getByLabelText('Action description');
    fireEvent.change(habitInput, { target: { value: 'Composted dry garden leaves' } });
    fireEvent.click(screen.getByRole('button', { name: /Add action to tracker/i }));
    expect(screen.getByText('Composted dry garden leaves')).toBeInTheDocument();

    // Edit the logged action
    const editBtn = screen.getByRole('button', {
      name: /Edit logged action Composted dry garden leaves/i,
    });
    fireEvent.click(editBtn);
    const editTitleInput = screen.getByLabelText('Action title');
    fireEvent.change(editTitleInput, { target: { value: 'Composted leaves (edited)' } });
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));
    expect(screen.getByText('Composted leaves (edited)')).toBeInTheDocument();

    // Remove the edited action
    const deleteBtn = screen.getByRole('button', {
      name: /Delete logged action Composted leaves \(edited\)/i,
    });
    fireEvent.click(deleteBtn);
    expect(screen.queryByText('Composted leaves (edited)')).not.toBeInTheDocument();
  });

  it('recovers from corrupted localStorage profile, empty environmental history, missing AQI, provider 503, and offline state', async () => {
    // Corrupted profile + empty impact logs in localStorage
    window.localStorage.setItem('breathewise.v1.profile', '{corrupt-json');
    window.localStorage.setItem('breathewise.v1.impactLogs', '[]');

    const freshIso = new Date().toISOString();
    let providerDown = false;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/air-quality/current')) {
          if (providerDown) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 'AQI_PROVIDER_UNAVAILABLE',
                  message: 'AirLive upstream feed is unreachable.',
                  retryable: true,
                },
              }),
              { status: 503, headers: { 'Content-Type': 'application/json' } },
            );
          }
          return new Response(
            JSON.stringify({
              location: {
                id: 'delhi',
                slug: 'delhi',
                name: 'Delhi',
                city: 'Delhi',
                state: 'India',
                country: 'IN',
                countryName: 'India',
                kind: 'city',
                lat: 28.6139,
                lon: 77.209,
              },
              aqi: {
                value: null,
                scale: 'US_AQI',
                category: 'Unavailable',
                dominantPollutant: 'Unavailable',
              },
              pollutants: [
                {
                  key: 'pm25',
                  label: 'PM2.5',
                  value: null,
                  unit: 'µg/m³',
                  subIndex: null,
                  safeReference: 'WHO 24h: 15 µg/m³',
                  status: 'unavailable',
                },
              ],
              missingPollutants: ['usAqi', 'pm25'],
              provenance: {
                providerId: 'airlive',
                providerName: 'AirLive',
                stationName: 'Delhi',
                measurementType: 'ground_station',
                sourceLabel: 'Ground Stations',
                stationsUsed: 0,
                observedAt: null,
                fetchedAt: freshIso,
                isStale: true,
                freshnessStatus: 'unavailable',
                attribution: 'Data: AirLive.',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ items: [], count: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    render(<App />);

    // Missing AQI reading displays N/A & Unavailable without fabricating zero
    await waitFor(() => {
      expect(screen.getByTestId('aqi-value')).toHaveTextContent('N/A');
    });
    expect(screen.getByTestId('pm25-value')).toHaveTextContent('Unavailable');
    expect(screen.getByText('No actions logged yet.')).toBeInTheDocument();

    // Verify Impact page EmptyState when environmental history is empty
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' });
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Environmental Impact' }));
    expect(await screen.findByText(/No household actions logged yet/i)).toBeInTheDocument();

    // Trigger offline event and verify Overview offline banner + preview fallback + provider 503 recovery
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Overview' }));
    window.dispatchEvent(new Event('offline'));
    expect(await screen.findByText(/Offline connection detected:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Use preview fixture offline/i }));
    expect(await screen.findByText(/Preview Fixture Mode:/i)).toBeInTheDocument();

    // Restore online and switch back to Live API while provider returns 503
    window.dispatchEvent(new Event('online'));
    providerDown = true;
    fireEvent.click(screen.getByRole('button', { name: /Switch to Live AirLive/i }));
    await waitFor(() => {
      expect(screen.getByText(/Live AirLive reading unavailable for this location/i)).toBeInTheDocument();
    });
  });

  it('supports manual coordinate lookup on Air Quality page and complete profile deletion in Settings', async () => {
    render(<App />);
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' });

    // Manual coordinate entry on Air Quality page
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Air Quality' }));
    const coordsToggle = await screen.findByRole('button', { name: /Enter coordinates/i });
    fireEvent.click(coordsToggle);

    fireEvent.change(screen.getByLabelText(/Latitude/i), { target: { value: '28.6139' } });
    fireEvent.change(screen.getByLabelText(/Longitude/i), { target: { value: '77.2090' } });
    fireEvent.click(screen.getByRole('button', { name: /Match nearest station/i }));

    await waitFor(() => {
      expect(screen.getByTestId('aqi-value')).toHaveTextContent('262');
    });

    // Clear personal profile & history in Settings
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Settings' }));
    const clearBtn = await screen.findByRole('button', { name: /Clear personal profile & history/i });
    fireEvent.click(clearBtn);

    const confirmDeleteBtn = await screen.findByRole('button', { name: /Delete personal data/i });
    fireEvent.click(confirmDeleteBtn);

    expect(await screen.findByText(/Personal profile and history cleared/i)).toBeInTheDocument();
    expect(screen.getByText(/Active household: My Household/i)).toBeInTheDocument();

    fireEvent.click(within(mainNav).getByRole('button', { name: 'Overview' }));
    expect(await screen.findByText('No actions logged yet.')).toBeInTheDocument();
  });

  it('labels live ventilation window as Est. US AQI, binds Household label error via aria-describedby, and resets Assistant chat on city switch', async () => {
    render(<App />);
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' });

    await waitFor(() => {
      expect(screen.getByTestId('aqi-value')).toHaveTextContent('262');
    });

    // 1. Live US AQI mode must label ventilation window as Est. US AQI (never Est. NAQI)
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Indoor Air' }));
    expect(await screen.findByText(/Min Est\. US AQI 262/i)).toBeInTheDocument();
    expect(screen.queryByText(/Min Est\. NAQI/i)).not.toBeInTheDocument();

    // 2. FamilyPage blank household label binds accessible aria-describedby error text
    fireEvent.click(within(mainNav).getByRole('button', { name: 'My Family' }));
    const householdInput = await screen.findByLabelText('Household label');
    fireEvent.change(householdInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Family Profile/i }));
    expect(householdInput).toHaveAttribute('aria-invalid', 'true');
    const describedId = householdInput.getAttribute('aria-describedby');
    expect(describedId).toBeTruthy();
    expect(document.getElementById(describedId!)).toHaveTextContent(/Enter a household label/i);

    // 3. AssistantPage resets conversation & excludes stale city history when location switches
    fireEvent.click(within(mainNav).getByRole('button', { name: 'AI Assistant' }));
    const chatInput = await screen.findByLabelText('Ask an air quality question');
    fireEvent.change(chatInput, { target: { value: 'Is it safe to jog outside today?' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Based on Delhi live US AQI 262/i)).toBeInTheDocument();
    });

    // Switch location via header selector while on AI Assistant
    fireEvent.click(screen.getByRole('button', { name: /Select monitoring location/i }));
    fireEvent.change(screen.getByLabelText('Search Indian locations'), { target: { value: 'Anand' } });
    fireEvent.click(await screen.findByRole('option', { name: /Anand Vihar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Location switched to Anand Vihar/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Based on Delhi live US AQI 262/i)).not.toBeInTheDocument();
  });

  it('handles airQualityApi timeouts/429 errors, Cleanest Cities ranking toggle, Community Advisory export, and LocationSelector Escape focus return', async () => {
    // 1. ApiClientError TIMEOUT & HTTP 429 handling
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }),
    );

    const dummyLoc = {
      id: 'delhi',
      slug: 'delhi',
      name: 'Delhi',
      city: 'Delhi',
      state: 'India',
      country: 'IN',
      countryName: 'India',
      lat: 28.6139,
      lon: 77.209,
    };

    await expect(fetchLiveCurrentAirQuality(dummyLoc, { timeoutMs: 15 })).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'TIMEOUT',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Slow down', retryable: true } }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    await expect(fetchLiveCurrentAirQuality(dummyLoc)).rejects.toBeInstanceOf(ApiClientError);

    // 2. Restore normal mock fetch and test Ranking toggle, Planner advisory & LocationSelector focus
    const mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('aqi-value')).toHaveTextContent('262');
    });

    // LocationSelector Escape restores focus to trigger button
    const locTrigger = screen.getByRole('button', { name: /Select monitoring location/i });
    locTrigger.focus();
    fireEvent.click(locTrigger);
    expect(screen.getByLabelText('Search Indian locations')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByLabelText('Search Indian locations')).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(locTrigger);

    // Cleanest Cities ranking toggle updates heading & calls order=best
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' });
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Air Quality' }));
    expect(await screen.findByText(/Most Polluted Cities in India Right Now/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cleanest Cities/i }));
    await waitFor(() => {
      expect(screen.getByText(/Cleanest Cities in India Right Now/i)).toBeInTheDocument();
    });
    expect(
      mockFetch.mock.calls.some(([url]) => String(url).includes('order=best')),
    ).toBe(true);

    // Planner Copy community advisory (with clipboard fallback preview when navigator.clipboard is mocked)
    fireEvent.click(within(mainNav).getByRole('button', { name: 'Daily Planner' }));
    const copyBtn = await screen.findByRole('button', { name: /Copy community advisory/i });
    fireEvent.click(copyBtn);
    await waitFor(() => {
      const hasStatus = screen.queryByText(/Community & family air-quality advisory copied/i);
      const hasPreview = screen.queryByText(/Shareable Family & Community Advisory/i);
      expect(Boolean(hasStatus || hasPreview)).toBe(true);
    });
  });

  it('falls back cleanly when /api returns non-JSON 404 or HTML SPA 200, surfaces clear /api/ai/chat 404 error, and avoids aborting cold current fetches', async () => {
    const freshIso = new Date().toISOString();
    const unmountedMockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      // Simulate static server returning HTML 404 or SPA index.html 200 for /api/*
      if (url.startsWith('/api/air-quality/current')) {
        return new Response('<html><body>404 Not Found</body></html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      if (url.startsWith('/api/air-quality/places') || url.startsWith('/api/air-quality/ranking')) {
        return new Response('<!doctype html><html><body>SPA fallback</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      if (url.startsWith('/api/air-quality/history')) {
        return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
      }
      if (url.startsWith('/api/ai/chat')) {
        return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
      }

      // Direct AirLive CORS fallback endpoints
      if (url === 'https://airlive.tracsa.co.in/api/v1/aqi/delhi') {
        return new Response(
          JSON.stringify({
            slug: 'delhi',
            name: 'Delhi',
            kind: 'city',
            country: 'IN',
            countryName: 'India',
            lat: 28.6139,
            lon: 77.209,
            usAqi: 215,
            category: 'Very Unhealthy',
            pm25: 162.4,
            source: 'ground stations',
            stationsUsed: 3,
            updated: freshIso,
            url: 'https://airlive.tracsa.co.in/aqi/delhi',
            attribution: 'Data: AirLive (https://airlive.tracsa.co.in).',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url === 'https://airlive.tracsa.co.in/api/v1/aqi') {
        return new Response(
          JSON.stringify({
            updated: freshIso,
            items: [
              {
                slug: 'delhi',
                name: 'Delhi',
                kind: 'city',
                country: 'IN',
                countryName: 'India',
                lat: 28.6139,
                lon: 77.209,
                usAqi: 215,
                category: 'Very Unhealthy',
                pm25: 162.4,
                source: 'ground stations',
                stationsUsed: 3,
                updated: freshIso,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.startsWith('https://airlive.tracsa.co.in/api/v1/ranking')) {
        return new Response(
          JSON.stringify({
            updated: freshIso,
            items: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.startsWith('https://air-quality-api.open-meteo.com/v1/air-quality')) {
        return new Response(
          JSON.stringify({
            latitude: 28.6,
            longitude: 77.2,
            hourly: { time: [freshIso], pm2_5: [150], pm10: [220] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not Found', { status: 404 });
    });

    vi.stubGlobal('fetch', unmountedMockFetch);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('aqi-value')).toHaveTextContent('215');
    });
    expect(screen.queryByText(/Server returned HTTP 404/i)).not.toBeInTheDocument();

    // Cold-load places hydration must not trigger a second aborted /api/air-quality/current call
    const currentApiCalls = unmountedMockFetch.mock.calls.filter(([u]) =>
      String(u).startsWith('/api/air-quality/current'),
    );
    expect(currentApiCalls).toHaveLength(1);

    // /api/ai/chat returning HTML/plain 404 yields BACKEND_API_UNAVAILABLE instead of "Server returned HTTP 404"
    await expect(
      sendAiChatMessage({
        message: 'Is it safe outside?',
        slug: 'delhi',
        history: [],
        familyProfile: DEFAULT_FAMILY_PROFILE,
      }),
    ).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'BACKEND_API_UNAVAILABLE',
    });

    // AssistantPage shows clean server-unavailable alert + explicit rule-based guidance button
    const nav = screen.getByRole('navigation', { name: /Main navigation/i });
    fireEvent.click(within(nav).getByRole('button', { name: 'AI Assistant' }));
    const askInput = await screen.findByLabelText(/Ask an air quality question/i);
    fireEvent.change(askInput, { target: { value: 'Is it safe to jog outside today?' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/i }));

    expect(await screen.findByText(/AI server endpoint unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/npm start/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Show rule-based guidance \(No AI\)/i }));
    expect(await screen.findByText(/Rule-Based Fallback \(AI Unavailable\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/US AQI 215/i).length).toBeGreaterThanOrEqual(1);
  });
});

