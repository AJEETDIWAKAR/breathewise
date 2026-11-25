import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  DEFAULT_FAMILY_PROFILE,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PREVIEW_IMPACT_LOGS,
  PRESET_LOCATIONS,
  getPreviewFixtureReading,
} from '../../data/previewFixtures';
import { Wind } from 'lucide-react';
import type { AirQualityRankingItem } from '../../types/breathewise';
import { AqiScaleGuideCard, IndiaRankingCard } from '../air-quality/AirQualityReferenceCards';
import {
  OverviewStateNotice,
  OverviewStatusBanners,
  RecentImpactCard,
} from '../overview/OverviewSections';
import { HeaderMenus } from './HeaderMenus';
import { MobileNavDrawer } from './MobileNavDrawer';
import App from '../../App';

function buildAppFetchStub(options: {
  currentErrorStatus?: number;
  emptyHistory?: boolean;
  aiUnavailable?: boolean;
} = {}) {
  const freshIso = new Date().toISOString();
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/api/air-quality/places')) {
      return new Response(
        JSON.stringify({
          updated: freshIso,
          count: 1,
          attribution: 'Data: AirLive.',
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
              usAqi: 185,
              category: 'Unhealthy',
              pm25: 112.4,
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

    if (url.includes('/api/air-quality/current')) {
      if (options.currentErrorStatus) {
        return new Response(
          JSON.stringify({ error: { code: 'AQI_PROVIDER_UNAVAILABLE', message: 'Upstream 403' } }),
          { status: options.currentErrorStatus, headers: { 'Content-Type': 'application/json' } },
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
          aqi: { value: 185, scale: 'US_AQI', category: 'Unhealthy', dominantPollutant: 'PM2.5' },
          pollutants: [
            {
              key: 'pm25',
              label: 'PM2.5',
              value: 112.4,
              unit: 'µg/m³',
              subIndex: 185,
              safeReference: 'WHO 24h: 15 µg/m³',
              status: 'unhealthy',
            },
          ],
          missingPollutants: [],
          provenance: {
            providerId: 'airlive',
            providerName: 'AirLive',
            stationName: 'Delhi (3 stations)',
            measurementType: 'ground_station',
            sourceLabel: 'Ground Stations',
            stationsUsed: 3,
            observedAt: freshIso,
            fetchedAt: freshIso,
            isStale: false,
            freshnessStatus: 'fresh',
            attribution: 'Data: AirLive.',
            attributionUrl: 'https://airlive.tracsa.co.in',
            cacheHit: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/air-quality/ranking')) {
      return new Response(
        JSON.stringify({
          updated: freshIso,
          attribution: 'Data: AirLive.',
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
              usAqi: 185,
              category: 'Unhealthy',
              pm25: 112.4,
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
          providerId: 'open-meteo',
          providerName: 'Open-Meteo',
          hourly: options.emptyHistory
            ? []
            : [
                {
                  hourLabel: '07:00',
                  timestamp: freshIso,
                  pm25: 110,
                  pm10: 150,
                  estimatedNaqi: 180,
                  category: 'Unhealthy',
                  scale: 'US_AQI',
                },
                {
                  hourLabel: '14:00',
                  timestamp: freshIso,
                  pm25: 45,
                  pm10: 70,
                  estimatedNaqi: 120,
                  category: 'Unhealthy for Sensitive Groups',
                  scale: 'US_AQI',
                },
              ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.includes('/api/ai/chat')) {
      if (options.aiUnavailable) {
        return new Response('<html>404</html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

describe('HeaderMenus, MobileNavDrawer, OverviewSections, and AirQualityReferenceCards', () => {
  it('supports keyboard ArrowUp/ArrowDown/Escape, click-outside, notifications, and mobile drawer selection', () => {
    const onMarkRead = vi.fn();
    const onSelectPage = vi.fn();
    const notifs = [
      ...DEFAULT_NOTIFICATIONS,
      {
        id: 'n-no-target',
        title: 'General alert',
        message: 'Info only',
        severity: 'info' as const,
        timestamp: 'Now',
        read: false,
      },
    ];

    render(
      <div>
        <div data-testid="outside-area">Outside</div>
        <HeaderMenus
          familyProfile={DEFAULT_FAMILY_PROFILE}
          totalMembers={4}
          notifications={notifs}
          unreadCount={2}
          onMarkAllNotificationsRead={onMarkRead}
          onSelectPage={onSelectPage}
        />
      </div>,
    );

    // Open notifications -> mark read -> click item with no targetPage -> closes menu
    const notifBtn = screen.getByRole('button', { name: /Notifications/i });
    fireEvent.click(notifBtn);
    expect(screen.getByRole('region', { name: 'Notifications panel' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(onMarkRead).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('General alert'));
    expect(screen.queryByRole('region', { name: 'Notifications panel' })).not.toBeInTheDocument();

    // Open notifications again -> Escape restores focus to trigger
    fireEvent.click(notifBtn);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(notifBtn);

    // Profile dropdown -> ArrowDown / ArrowUp navigation -> navigate to settings
    const profileBtn = screen.getByRole('button', { name: 'Household profile menu' });
    fireEvent.click(profileBtn);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveTextContent('Edit My Family Profile');
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement).toHaveTextContent('Data Mode & Settings');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Data Mode & Settings' }));
    expect(onSelectPage).toHaveBeenCalledWith('settings');

    // Click outside closes open profile menu
    fireEvent.click(profileBtn);
    fireEvent.mouseDown(screen.getByTestId('outside-area'));
    expect(screen.queryByRole('menu', { name: 'Profile options' })).not.toBeInTheDocument();
  });

  it('renders MobileNavDrawer, OverviewSections states, and AirQualityReferenceCards edge states', () => {
    const onClose = vi.fn();
    const onSelectPage = vi.fn();
    const { rerender } = render(
      <MobileNavDrawer
        open
        activePage="overview"
        navItems={[{ id: 'overview', label: 'Overview', shortLabel: 'Home', icon: Wind }]}
        onClose={onClose}
        onSelectPage={onSelectPage}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(onSelectPage).toHaveBeenCalledWith('overview');
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation menu' }));
    expect(onClose).toHaveBeenCalled();

    const onSetDataState = vi.fn();
    const onRetry = vi.fn();
    rerender(
      <div>
        <OverviewStatusBanners dataState="live" isOffline onSetDataState={onSetDataState} />
        <OverviewStateNotice
          dataState="unavailable"
          liveStatus="unavailable"
          liveError={{ code: 'AQI_PROVIDER_UNAVAILABLE', message: 'Upstream 403' }}
          onSetDataState={onSetDataState}
          onRetryLiveCheck={onRetry}
        />
        <RecentImpactCard impactLogs={[]} onNavigate={onSelectPage} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use preview fixture offline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load labeled preview fixture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry live check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Impact Tracker' }));
    expect(onSetDataState).toHaveBeenCalledWith('preview');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onSelectPage).toHaveBeenCalledWith('impact');

    rerender(
      <div>
        <OverviewStateNotice
          dataState="error"
          liveStatus="error"
          liveError={{ code: 'BACKEND_API_UNAVAILABLE', message: 'Backend down' }}
          onSetDataState={onSetDataState}
          onRetryLiveCheck={onRetry}
        />
        <RecentImpactCard
          impactLogs={DEFAULT_PREVIEW_IMPACT_LOGS}
          onNavigate={onSelectPage}
        />
        <IndiaRankingCard
          indiaRanking={[]}
          rankingOrder="worst"
          onChangeOrder={vi.fn()}
          rankingLoading
          rankingError={null}
          activeLocationSlug="delhi"
          onSelectLocation={vi.fn()}
        />
        <IndiaRankingCard
          indiaRanking={[]}
          rankingOrder="best"
          onChangeOrder={vi.fn()}
          rankingLoading={false}
          rankingError="Ranking failed"
          activeLocationSlug="delhi"
          onSelectLocation={vi.fn()}
        />
        <IndiaRankingCard
          indiaRanking={[]}
          rankingOrder="worst"
          onChangeOrder={vi.fn()}
          rankingLoading={false}
          rankingError={null}
          activeLocationSlug="delhi"
          onSelectLocation={vi.fn()}
        />
        <AqiScaleGuideCard dataState="preview" onRetryLiveCheck={onRetry} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'View preview fixture' }));
    expect(screen.getByText('Ranking failed')).toBeInTheDocument();
    expect(screen.getByText('No city ranking entries available right now.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use Live AirLive' }));
    expect(onRetry).toHaveBeenCalled();

    const item: AirQualityRankingItem = {
      rank: 1,
      slug: 'pune',
      name: 'Pune',
      kind: 'city',
      country: 'IN',
      countryName: 'India',
      lat: 18.52,
      lon: 73.85,
      usAqi: 75,
      category: 'Moderate',
      pm25: 24,
      source: 'model',
      measurementType: 'modeled_forecast',
      stationsUsed: null,
      updated: null,
      freshnessStatus: 'unavailable',
    };
    const onSelectLoc = vi.fn();
    rerender(
      <IndiaRankingCard
        indiaRanking={[item]}
        rankingOrder="worst"
        onChangeOrder={vi.fn()}
        rankingLoading={false}
        rankingError={null}
        activeLocationSlug="delhi"
        onSelectLocation={onSelectLoc}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(onSelectLoc).toHaveBeenCalledWith(expect.objectContaining({ slug: 'pune' }));
  });
});

describe('Full App page interactions and edge controls', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigates Overview quick buttons, empty hourly state, and mobile drawer menu', async () => {
    vi.stubGlobal('fetch', buildAppFetchStub({ emptyHistory: true }));
    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('Current Air Quality Summary')).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Hourly concentration trajectory is currently unavailable/i),
    ).toBeInTheDocument();

    // Test overview recommendation routing and quick buttons
    fireEvent.click(screen.getByRole('button', { name: 'Ventilation windows' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Indoor Air' })).toBeInTheDocument(),
    );

    const sidebar = screen.getByRole('navigation', { name: 'Main navigation' });
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Overview' }));
    const askAiBtn = await screen.findByRole('button', { name: 'Ask AI Assistant' });
    fireEvent.click(askAiBtn);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'AI Assistant' })).toBeInTheDocument(),
    );

    // Test Assistant validation (>1000 chars), Clear chat, and BACKEND_API_UNAVAILABLE fallback
    vi.stubGlobal('fetch', buildAppFetchStub({ aiUnavailable: true }));
    const input = await screen.findByLabelText('Ask an air quality question');
    fireEvent.change(input, { target: { value: 'a'.repeat(1001) } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Question is too long');

    fireEvent.change(input, { target: { value: 'Is outdoor jogging safe?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(screen.getByText('AI server endpoint unavailable')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /Show rule-based guidance/i }));
    await waitFor(() =>
      expect(screen.getByText('Rule-Based Fallback (AI Unavailable)')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry with Gemini' }));
    await waitFor(() =>
      expect(screen.getByText('AI server endpoint unavailable')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear chat' }));
    expect(screen.getByText(/Conversation cleared/i)).toBeInTheDocument();

    // Open mobile drawer and pick Planner
    fireEvent.click(screen.getByRole('button', { name: 'More pages' }));
    const mobileNav = screen.getByRole('navigation', { name: 'Mobile full navigation' });
    fireEvent.click(within(mobileNav).getByRole('button', { name: 'Daily Planner' }));
    expect(await screen.findByText('Personalized Daily Schedule')).toBeInTheDocument();
  });

  it('exercises PlannerPage clipboard fallback, ImpactPage edit/delete/methodology, SettingsPage modals, and LocationSelector search', async () => {
    vi.stubGlobal('fetch', buildAppFetchStub());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('Clipboard blocked')) },
    });

    render(<App />);
    await waitFor(() =>
      expect(screen.getByText('Current Air Quality Summary')).toBeInTheDocument(),
    );

    // LocationSelector empty search + clear search
    fireEvent.click(screen.getByRole('button', { name: 'Select monitoring location' }));
    const searchInput = screen.getByLabelText('Search Indian locations');
    fireEvent.change(searchInput, { target: { value: 'NoSuchPlaceXYZ' } });
    expect(screen.getByText(/No matching supported AirLive locations found/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear location search' }));
    expect((searchInput as HTMLInputElement).value).toBe('');
    fireEvent.keyDown(window, { key: 'Escape' });

    // PlannerPage: copy advisory fallback preview + dismiss + toggle done + edit family
    const sidebar = screen.getByRole('navigation', { name: 'Main navigation' });
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Daily Planner' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy community advisory' }));
    await waitFor(() =>
      expect(screen.getByText(/Shareable Family & Community Advisory/i)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Shareable Family & Community Advisory/i)).not.toBeInTheDocument();

    const toggleBtns = screen.getAllByRole('button', { name: /Mark routine block done/i });
    fireEvent.click(toggleBtns[0]);
    expect(screen.getByText('Completed for today')).toBeInTheDocument();

    // ImpactPage: empty habit validation -> valid log -> methodology modal -> edit -> save -> delete
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Environmental Impact' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add action to tracker' }));
    expect(
      screen.getByText('Please describe the exposure-management or household sustainability action.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Action description'), {
      target: { value: 'Wet mopped bedroom floors' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add action to tracker' }));
    expect(screen.getByText('Wet mopped bedroom floors')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View calculation methodology/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    const editButtons = screen.getAllByRole('button', { name: /Edit /i });
    fireEvent.click(editButtons[0]);
    const modal = screen.getByRole('dialog');
    const titleInput = within(modal).getByLabelText('Action title');
    fireEvent.change(titleInput, { target: { value: '' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Action title cannot be empty.')).toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: 'Wet mopped living room' } });
    fireEvent.change(within(modal).getByLabelText('Date'), { target: { value: '2026-11-18' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Wet mopped living room')).toBeInTheDocument();

    // Log Personal Transport Shift (Pillar A) and delete one entry
    fireEvent.change(screen.getByLabelText('Displaced baseline vehicle'), {
      target: { value: 'diesel_car' },
    });
    fireEvent.change(screen.getByLabelText('Chosen lower-emission mode'), {
      target: { value: 'public_bus' },
    });
    fireEvent.change(screen.getByLabelText('Distance (km)'), { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: /Log shift/i }));
    expect(screen.getByText(/Chose Public Bus over Diesel Car/i)).toBeInTheDocument();

    const deleteBtns = screen.getAllByRole('button', { name: /Delete /i });
    fireEvent.click(deleteBtns[0]);

    // SettingsPage: unit switch, data mode switch, checkbox, cancel & confirm modals
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Settings' }));
    fireEvent.change(await screen.findByLabelText('Primary metric display'), { target: { value: 'ugm3' } });
    expect(screen.getByText('Metric display updated')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Data source mode'), { target: { value: 'preview' } });
    expect(screen.getByText('Preference updated')).toBeInTheDocument();

    const thresholdCheck = screen.getByRole('checkbox');
    fireEvent.click(thresholdCheck);
    expect(screen.getByText('Alert preference updated')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Clear personal profile & history/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /Clear personal profile & history/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete personal data' }));
    expect(screen.getByText('Personal profile and history cleared')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Restore sample demo household/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /Restore sample demo household/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore sample data' }));
    expect(screen.getByText('Sample demo household restored')).toBeInTheDocument();

    // Overview RecommendationPanel action routing in preview mode (with diesel commute so commute card renders)
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Overview' }));
    await waitFor(() =>
      expect(screen.getByText('Current Air Quality Summary')).toBeInTheDocument(),
    );
    const actionBtns = screen.getAllByRole('button', { name: /Open details for /i });
    expect(actionBtns.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(actionBtns[1]);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Indoor Air' })).toBeInTheDocument(),
    );

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Overview' }));
    await waitFor(() =>
      expect(screen.getByText('Current Air Quality Summary')).toBeInTheDocument(),
    );
    const actionBtns2 = screen.getAllByRole('button', { name: /Open details for /i });
    fireEvent.click(actionBtns2[2]);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Sustainable Choices' })).toBeInTheDocument(),
    );

    expect(getPreviewFixtureReading(PRESET_LOCATIONS[0]).location.slug).toBe('delhi');
  });
});

