import { fetch } from "../../helpers/fetch";
import type { Token } from "../api/Token";
import type { Logger } from "../logger/Logger";
import { getRealtimeURL } from "./getRealtimeURL";

const FALLBACK_URL = "https://runtime.aikido.dev";

export async function resolveRealtimeURL(
  token: Token,
  logger: Logger
): Promise<URL> {
  const realtimeURL = getRealtimeURL();

  if (process.env.AIKIDO_REALTIME_ENDPOINT) {
    return realtimeURL;
  }

  try {
    await fetch({
      url: new URL(`${realtimeURL.toString()}config`),
      method: "GET",
      headers: {
        Authorization: token.asString(),
      },
      timeoutInMS: 5000,
    });

    return realtimeURL;
  } catch {
    logger.log(
      `Unable to reach ${realtimeURL.hostname}, falling back to ${FALLBACK_URL}. Realtime updates (SSE) will not be available, using polling instead.`
    );

    return new URL(FALLBACK_URL);
  }
}
