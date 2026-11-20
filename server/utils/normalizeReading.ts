import {
  buildAirLiveReading,
  evaluateStaleness,
  type RawAirLivePlaceInput,
} from '../../src/domain/airliveNormalize.ts';
import type { NormalizedCurrentAirQuality } from '../providers/types.ts';

export { evaluateStaleness };
export type BuildAirLiveInput = RawAirLivePlaceInput;

export function buildAirLiveNormalizedReading(
  item: BuildAirLiveInput,
): NormalizedCurrentAirQuality {
  const reading = buildAirLiveReading(item);
  return {
    ...reading,
    missingPollutants: reading.missingPollutants ?? [],
    pollutants: reading.pollutants.map((p) => ({
      ...p,
      status: p.status ?? (p.value === null ? 'unavailable' : 'measured'),
    })),
    provenance: {
      ...reading.provenance,
      providerId: 'airlive',
      measurementType: reading.provenance.measurementType === 'ground_station' ? 'ground_station' : 'modeled_forecast',
      sourceLabel: reading.provenance.sourceLabel ?? 'AirLive Station',
      stationsUsed: reading.provenance.stationsUsed ?? null,
      freshnessStatus: reading.provenance.freshnessStatus ?? 'unavailable',
      spatialResolution: reading.provenance.spatialResolution ?? 'City / area station aggregation',
      coverageLimitations: reading.provenance.coverageLimitations ?? '',
    },
  };
}
