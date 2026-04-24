import { isDebuggingSSE } from "../../helpers/isDebuggingSSE";
import { connectToSSE } from "./connectToSSE";
import type { ConfigUpdateOptions } from "./ConfigUpdateOptions";
import { getConfig } from "./getConfig";

export function listenForConfigUpdates({
  onConfigUpdate,
  token,
  logger,
  lastUpdatedAt,
}: ConfigUpdateOptions) {
  if (!token) {
    logger.log("No token provided, not listening for config updates");
    return;
  }

  const validToken = token;
  const debugSSE = isDebuggingSSE();
  let currentLastUpdatedAt = lastUpdatedAt;

  connectToSSE({
    token,
    logger,
    onEvent(event) {
      if (debugSSE) {
        logger.log(`SSE event received: ${event.event}`);
      }
      if (event.event !== "config-updated") {
        return;
      }

      try {
        const payload: { configUpdatedAt: number } = JSON.parse(event.data);
        if (payload.configUpdatedAt <= currentLastUpdatedAt) {
          return;
        }
      } catch {
        // If we can't parse the payload, fetch the config anyway
      }

      if (debugSSE) {
        logger.log("SSE config-updated event, fetching new config");
      }

      getConfig(validToken)
        .then((config) => {
          if (debugSSE) {
            logger.log(
              `SSE config fetched, configUpdatedAt: ${config.configUpdatedAt}`
            );
          }
          currentLastUpdatedAt = config.configUpdatedAt;
          onConfigUpdate(config);
        })
        .catch((error) => {
          logger.log(
            `Failed to fetch config after SSE event: ${error.message}`
          );
        });
    },
  });
}
