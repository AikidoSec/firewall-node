import { Token } from "../api/Token";
import { ConfigAPI, ConfigAPIResponse } from "./ConfigAPI";

export class ConfigAPIForTesting implements ConfigAPI {
  constructor(
    private lastUpdatedAt = 0,
    private config: ConfigAPIResponse = {
      configUpdatedAt: 0,
      success: true,
      endpoints: [],
      heartbeatIntervalInMS: 10 * 60 * 1000,
    }
  ) {}

  async getLastUpdatedAt(token: Token): Promise<number> {
    return this.lastUpdatedAt;
  }

  update(lastUpdatedAt: number) {
    this.lastUpdatedAt = lastUpdatedAt;
    this.config.configUpdatedAt = lastUpdatedAt;
  }

  async getConfig(token: Token): Promise<ConfigAPIResponse> {
    return this.config;
  }
}
