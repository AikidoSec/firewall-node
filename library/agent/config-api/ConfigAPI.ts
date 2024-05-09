import { Token } from "../api/Token";

/**
 * This API is used to get the last updated timestamp of the configuration.
 *
 * The actual configuration can be fetched using the ReportingAPI.
 */
export interface ConfigAPI {
  getLastUpdatedAt(token: Token): Promise<number>;
}
