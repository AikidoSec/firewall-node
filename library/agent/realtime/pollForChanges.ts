import { Token } from "../api/Token";
import { Config } from "../Config";
import { Logger } from "../logger/Logger";
import { getConfig } from "./getConfig";
import { getConfigLastUpdatedAt } from "./getConfigLastUpdatedAt";

type OnConfigUpdate = (config: Config) => void;

let interval: NodeJS.Timeout | undefined;

export function pollForChanges({
  onConfigUpdate,
  serverless,
  token,
  logger,
  lastUpdatedAt,
}: {
  onConfigUpdate: OnConfigUpdate;
  token: Token | undefined;
  serverless: string | undefined;
  logger: Logger;
  lastUpdatedAt: number;
}) {
  if (!token) {
    logger.log("No token provided, not polling for config updates");
    return;
  }

  if (serverless) {
    logger.log(
      "Running in serverless environment, not polling for config updates"
    );
    return;
  }

  async function check(token: Token, onConfigUpdate: OnConfigUpdate) {
    const configLastUpdatedAt = await getConfigLastUpdatedAt(token);

    if (configLastUpdatedAt > lastUpdatedAt) {
      const config = await getConfig(token);
      lastUpdatedAt = config.lastUpdatedAt;
      onConfigUpdate(config);
    }
  }

  if (interval) {
    clearInterval(interval);
  }

  interval = setInterval(() => {
    check(token, onConfigUpdate).catch(() => {
      logger.log("Failed to check for config updates");
    });
  }, 60 * 1000);

  interval.unref();
}
