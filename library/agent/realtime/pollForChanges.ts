import type { Token } from "../api/Token";
import type { ConfigUpdateOptions } from "./ConfigUpdateOptions";
import { getConfig } from "./getConfig";
import { getConfigLastUpdatedAt } from "./getConfigLastUpdatedAt";

let interval: NodeJS.Timeout | null = null;
let currentLastUpdatedAt: number | null = null;

export function pollForChanges({
  onConfigUpdate,
  token,
  logger,
  lastUpdatedAt,
  realtimeURL,
}: ConfigUpdateOptions) {
  if (!token) {
    logger.log("No token provided, not polling for config updates");
    return;
  }

  currentLastUpdatedAt = lastUpdatedAt;

  if (interval) {
    clearInterval(interval);
  }

  interval = setInterval(() => {
    check(token, realtimeURL, onConfigUpdate).catch((error) => {
      logger.log(`Failed to check for config updates: ${error.message}`);
    });
  }, 60 * 1000);

  interval.unref();
}

async function check(
  token: Token,
  realtimeURL: URL,
  onConfigUpdate: ConfigUpdateOptions["onConfigUpdate"]
) {
  const configLastUpdatedAt = await getConfigLastUpdatedAt(token, realtimeURL);

  if (
    typeof currentLastUpdatedAt === "number" &&
    configLastUpdatedAt > currentLastUpdatedAt
  ) {
    const config = await getConfig(token);
    currentLastUpdatedAt = config.configUpdatedAt;
    onConfigUpdate(config);
  }
}
