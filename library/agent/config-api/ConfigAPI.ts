import { Token } from "../api/Token";

type Endpoint = {
  method: string;
  route: string;
  forceProtectionOff: boolean;
};

export type ConfigAPIResponse = {
  success: true;
  endpoints: Endpoint[];
  heartbeatIntervalInMS: number;
  configUpdatedAt: number;
};

/**
 * This API is used to get the last updated timestamp of the configuration.
 *
 * The actual configuration can be fetched using the ReportingAPI.
 */
export interface ConfigAPI {
  getLastUpdatedAt(token: Token): Promise<number>;
  getConfig(token: Token): Promise<ConfigAPIResponse>;
}
