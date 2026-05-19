import { fetch } from "../../helpers/fetch";
import type { Token } from "../api/Token";
import type { Logger } from "../logger/Logger";
import { getRealtimeURL } from "./getRealtimeURL";

const FALLBACK_URL = "https://runtime.aikido.dev";
const MAX_RETRIES = 3;

async function probe(url: URL, token: Token): Promise<boolean> {
  try {
    await fetch({
      url,
      method: "GET",
      headers: {
        Authorization: token.asString(),
      },
      timeoutInMS: 5000,
    });

    return true;
  } catch {
    return false;
  }
}

export async function resolvePollingURL(
  token: Token,
  logger: Logger
): Promise<URL> {
  const realtimeURL = getRealtimeURL();

  if (process.env.AIKIDO_REALTIME_ENDPOINT) {
    return realtimeURL;
  }

  const configURL = new URL(`${realtimeURL.toString()}config`);
  let backoffMs = 1000;

  for (let i = 0; i < MAX_RETRIES; i++) {
    if (await probe(configURL, token)) {
      return realtimeURL;
    }

    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    backoffMs *= 2;
  }

  logger.log(
    `Unable to reach ${realtimeURL.hostname}, falling back to ${FALLBACK_URL}. Realtime updates (SSE) will not be available, using polling instead.`
  );

  return new URL(FALLBACK_URL);
}
