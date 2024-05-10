import { Token } from "./api/Token";
import { ConfigAPI, ConfigAPIResponse } from "./config-api/ConfigAPI";
import { Logger } from "./logger/Logger";

type Callback = (config: ConfigAPIResponse) => void;

export class ConfigChangeChecker {
  private interval: NodeJS.Timeout | null = null;
  private intervalInMS = 60 * 1000;

  constructor(
    private readonly configAPI: ConfigAPI,
    private readonly token: Token | undefined,
    private readonly serverless: string | undefined,
    private readonly logger: Logger,
    private configLastUpdatedAt: number
  ) {}

  private async configWasUpdated() {
    const lastUpdated = await this.configAPI.getLastUpdatedAt(this.token!);

    return lastUpdated > this.configLastUpdatedAt;
  }

  private async updateConfig(onConfigUpdate: Callback) {
    const config = await this.configAPI.getConfig(this.token!);
    this.configLastUpdatedAt = config.configUpdatedAt;
    onConfigUpdate(config);
  }

  private async check(onConfigUpdate: Callback) {
    if (await this.configWasUpdated()) {
      await this.updateConfig(onConfigUpdate);
    }
  }

  startPolling(onConfigUpdate: Callback) {
    if (!this.token) {
      this.logger.log("No token provided, not polling for config updates");
      return;
    }

    if (this.serverless) {
      this.logger.log(
        "Running in serverless environment, not polling for config updates"
      );
      return;
    }

    if (this.interval) {
      throw new Error("Polling already started");
    }

    this.interval = setInterval(() => {
      this.check(onConfigUpdate).catch(() => {
        this.logger.log("Failed to check for config updates");
      });
    }, this.intervalInMS);

    this.interval.unref();
  }
}
