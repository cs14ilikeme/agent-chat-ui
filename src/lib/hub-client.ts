import { GAGoClient, createGAGoClient, createWorkbenchClient } from './gago-client';

export class GaClawHubClient extends GAGoClient {}

export function createGaClawClient(config: { baseUrl: string; token?: string | null }): GaClawHubClient {
  return new GaClawHubClient(config);
}

export { createWorkbenchClient, GAGoClient, createGAGoClient };
