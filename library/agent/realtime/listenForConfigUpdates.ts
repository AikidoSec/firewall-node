import type { Config } from "../Config";
import type { Token } from "../api/Token";
import type { Logger } from "../logger/Logger";
import { isDebuggingSSE } from "../../helpers/isDebuggingSSE";
import { connectToSSE } from "./connectToSSE";
import { getConfig } from "./getConfig";

type OnConfigUpdate = (config: Config) => void;

export function listenForConfigUpdates({
  onConfigUpdate,
  token,
  logger,
  lastUpdatedAt,
}: {
  onConfigUpdate: OnConfigUpdate;
  token: Token | undefined;
  logger: Logger;
  lastUpdatedAt: number;
}) {
  if (!token) {
    logger.log("No token provided, not listening for config updates");
    return;
  }

  const validToken = token;
  const debugSSE = isDebuggingSSE();

  function logDebug(msg: string) {
    if (debugSSE) {
      logger.log(msg);
    }
  }

  let currentLastUpdatedAt = lastUpdatedAt;
  let lastConfigRefreshStartedAt = performance.now() - 9_000;

  function configUpdateArrivedTooFast() {
    const now = performance.now();
    if (now - lastConfigRefreshStartedAt < 9_000) {
      return true;
    }

    lastConfigRefreshStartedAt = now;
    return false;
  }

  connectToSSE({
    token,
    logger,
    onEvent(event) {
      logDebug(`SSE event received: ${event.event}`);
      if (event.event !== "config-updated") {
        return;
      }

      try {
        const payload: { configUpdatedAt: number } = JSON.parse(event.data);
        if (payload.configUpdatedAt <= currentLastUpdatedAt) {
          return;
        }
      } catch {
        logDebug(`SSE config-updated event has invalid payload: ${event.data}`);
        return;
      }

      if (configUpdateArrivedTooFast()) {
        logDebug("SSE config-updated event ignored by refresh throttle");
        return;
      }

      logDebug("SSE config-updated event, fetching new config");

      getConfig(validToken)
        .then((config) => {
          logDebug(
            `SSE config fetched, configUpdatedAt: ${config.configUpdatedAt}`
          );
          currentLastUpdatedAt = config.configUpdatedAt;
          onConfigUpdate(config);
        })
        .catch((error) => {
          logDebug(`Failed to fetch config after SSE event: ${error.message}`);
        });
    },
  });
}
