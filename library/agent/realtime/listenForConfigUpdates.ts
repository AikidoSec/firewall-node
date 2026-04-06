import { isDebuggingSSE } from "../../helpers/isDebuggingSSE";
import { Token } from "../api/Token";
import { Config } from "../Config";
import { Logger } from "../logger/Logger";
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
