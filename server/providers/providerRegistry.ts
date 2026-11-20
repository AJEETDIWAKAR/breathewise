import type { ServerConfig } from '../config/env.ts';
import { AirliveProvider } from './airliveProvider.ts';
import { OpenMeteoProvider } from './openMeteoProvider.ts';

export class AirQualityProviderRegistry {
  readonly airlive: AirliveProvider;
  readonly openMeteo: OpenMeteoProvider;

  constructor(config: ServerConfig) {
    this.airlive = new AirliveProvider(config.providerTimeoutMs);
    this.openMeteo = new OpenMeteoProvider(config.providerTimeoutMs);
  }

  getCapabilities() {
    return {
      primaryLiveProvider: {
        id: this.airlive.id,
        name: this.airlive.name,
        configured: this.airlive.isConfigured(),
        apiKeyRequired: false,
        attributionUrl: 'https://airlive.tracsa.co.in',
      },
      modeledTrajectory: {
        openMeteoCams: this.openMeteo.isConfigured(),
      },
    };
  }
}
