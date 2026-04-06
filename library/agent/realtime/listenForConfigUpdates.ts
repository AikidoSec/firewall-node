import { Token } from "../api/Token";
import { Config } from "../Config";
import { Logger } from "../logger/Logger";
import { connectToSSE } from "./connectToSSE";
import { getConfig } from "./getConfig";
import { getConfigLastUpdatedAt } from "./getConfigLastUpdatedAt";

type OnConfigUpdate = (config: Config) => void;

type ConfigListener = {
  stop(): void;
};

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
}): ConfigListener {
  if (!token) {
    logger.log("No token provided, not listening for config updates");
    return { stop() {} };
  }

  let currentLastUpdatedAt = lastUpdatedAt;
  let pollingInterval: NodeJS.Timeout | null = null;

  function startPolling() {
    if (pollingInterval) {
      return;
    }

    pollingInterval = setInterval(() => {
      checkForUpdates().catch((error) => {
        logger.log(`Failed to check for config updates: ${error.message}`);
      });
    }, 60 * 1000);

    pollingInterval.unref();
  }

  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  async function checkForUpdates() {
    const configLastUpdatedAt = await getConfigLastUpdatedAt(token!);

    if (configLastUpdatedAt > currentLastUpdatedAt) {
      const config = await getConfig(token!);
      currentLastUpdatedAt = config.configUpdatedAt;
      onConfigUpdate(config);
    }
  }

  // Start SSE connection for near-instant config updates
  const sse = connectToSSE({
    token,
    logger,
    onConnect() {
      stopPolling();
    },
    onDisconnect() {
      startPolling();
    },
    onEvent(event) {
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

      getConfig(token!)
        .then((config) => {
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

  // Start polling as fallback until SSE connects
  startPolling();

  return {
    stop() {
      sse.close();
      stopPolling();
    },
  };
}
