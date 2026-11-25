import { ExternalLink } from 'lucide-react';
import { getUsAqiVisualTokens, US_AQI_SCALE_GUIDE } from '../../domain/usAqi';
import type {
  AirQualityRankingItem,
  DashboardDataState,
  LocationOption,
} from '../../types/breathewise';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { PollutionStatusBadge } from '../ui/PollutionStatusBadge';
import { SegmentedTabs } from '../ui/Selector';
import { LoadingSkeleton } from '../ui/States';

function IndiaRankingBody({
  indiaRanking,
  rankingLoading,
  rankingError,
  activeLocationSlug,
  onSelectLocation,
}: {
  indiaRanking: AirQualityRankingItem[];
  rankingLoading: boolean;
  rankingError: string | null;
  activeLocationSlug: string;
  onSelectLocation: (loc: LocationOption) => void;
}) {
  if (rankingLoading) {
    return <LoadingSkeleton rows={3} />;
  }
  if (rankingError) {
    return <p className="text-sm text-amber-800 py-4">{rankingError}</p>;
  }
  if (indiaRanking.length === 0) {
    return <p className="text-sm text-slate-600 py-4">No city ranking entries available right now.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-600">
            <th scope="col" className="py-2.5 pr-3 font-semibold">#</th>
            <th scope="col" className="py-2.5 px-3 font-semibold">City</th>
            <th scope="col" className="py-2.5 px-3 font-semibold text-right">US AQI</th>
            <th scope="col" className="py-2.5 px-3 font-semibold">Category</th>
            <th scope="col" className="py-2.5 px-3 font-semibold text-right">PM2.5</th>
            <th scope="col" className="py-2.5 px-3 font-semibold">Source</th>
            <th scope="col" className="py-2.5 pl-3 font-semibold text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {indiaRanking.map((item) => {
            const isCurrent = item.slug === activeLocationSlug;
            return (
              <tr key={item.slug} className={isCurrent ? 'bg-teal-50/50' : 'hover:bg-slate-50'}>
                <td className="py-2.5 pr-3 font-mono text-slate-600">{item.rank}</td>
                <td className="py-2.5 px-3 font-medium text-slate-900">
                  {item.name}
                  <span className="ml-1.5 text-xs text-slate-600 font-normal">
                    ({item.countryName || item.country})
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                  {item.usAqi !== null ? item.usAqi : 'N/A'}
                </td>
                <td className="py-2.5 px-3">
                  <PollutionStatusBadge category={item.category} scale="US_AQI" compact />
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                  {item.pm25 !== null ? `${item.pm25} µg/m³` : 'Unavailable'}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-600">
                  {item.measurementType === 'ground_station'
                    ? `Ground Stations (${item.stationsUsed ?? '?'})`
                    : 'Atmospheric Model'}
                </td>
                <td className="py-2.5 pl-3 text-right">
                  <Button
                    variant={isCurrent ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() =>
                      onSelectLocation({
                        id: item.slug,
                        slug: item.slug,
                        name: item.name,
                        city: item.name,
                        state: item.countryName || 'India',
                        country: item.country,
                        countryName: item.countryName,
                        kind: item.kind,
                        lat: item.lat,
                        lon: item.lon,
                      })
                    }
                  >
                    {isCurrent ? 'Selected' : 'View'}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function IndiaRankingCard({
  indiaRanking,
  rankingOrder,
  onChangeOrder,
  rankingLoading,
  rankingError,
  activeLocationSlug,
  onSelectLocation,
}: {
  indiaRanking: AirQualityRankingItem[];
  rankingOrder: 'worst' | 'best';
  onChangeOrder: (order: 'worst' | 'best') => void;
  rankingLoading: boolean;
  rankingError: string | null;
  activeLocationSlug: string;
  onSelectLocation: (loc: LocationOption) => void;
}) {
  return (
    <Card>
      <CardHeader
        title={
          rankingOrder === 'best'
            ? 'Cleanest Cities in India Right Now'
            : 'Most Polluted Cities in India Right Now'
        }
        subtitle="Live top-10 ranking from AirLive (click any city to inspect its telemetry)"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedTabs
              ariaLabel="India city ranking sort order"
              value={rankingOrder}
              onChange={onChangeOrder}
              options={[
                { value: 'worst', label: 'Most Polluted' },
                { value: 'best', label: 'Cleanest Cities' },
              ]}
            />
            <a
              href="https://airlive.tracsa.co.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 min-h-6 px-1 text-xs font-medium text-teal-800 hover:underline"
            >
              <span>AirLive Ranking</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
        }
      />
      <IndiaRankingBody
        indiaRanking={indiaRanking}
        rankingLoading={rankingLoading}
        rankingError={rankingError}
        activeLocationSlug={activeLocationSlug}
        onSelectLocation={onSelectLocation}
      />
    </Card>
  );
}

export function AqiScaleGuideCard({
  dataState,
  onRetryLiveCheck,
}: {
  dataState: DashboardDataState;
  onRetryLiveCheck: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="US AQI 6-Band Reference Scale"
        subtitle="Standard US EPA AQI breakpoints used for all AirLive measurements"
        action={
          <Button variant="ghost" size="sm" onClick={onRetryLiveCheck}>
            {dataState === 'live' ? 'Refresh Live AirLive' : 'Use Live AirLive'}
          </Button>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-600">
              <th scope="col" className="py-2.5 pr-4 font-semibold">Category</th>
              <th scope="col" className="py-2.5 px-4 font-semibold">US AQI Range</th>
              <th scope="col" className="py-2.5 pl-4 font-semibold">Health Guidance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {US_AQI_SCALE_GUIDE.map((row) => {
              const tokens = getUsAqiVisualTokens(row.category);
              return (
                <tr key={row.category}>
                  <td className="py-3 pr-4">
                    <PollutionStatusBadge category={row.category} scale="US_AQI" compact />
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-800">{row.range}</td>
                  <td className="py-3 pl-4 text-slate-600">{tokens.healthSummary}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
