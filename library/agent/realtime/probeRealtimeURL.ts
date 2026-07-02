import { fetch } from "../../helpers/fetch";
import type { Token } from "../api/Token";
import type { Logger } from "../logger/Logger";
import { getRealtimeURL } from "./getRealtimeURL";

type RealtimeProbeResult = {
  pollingURL: URL;
  realtimeReachable: boolean;
};

export async function probeRealtimeURL(
  token: Token,
  logger: Logger
): Promise<RealtimeProbeResult> {
  const realtimeURL = getRealtimeURL();

  if (process.env.AIKIDO_REALTIME_ENDPOINT) {
    return { pollingURL: realtimeURL, realtimeReachable: true };
  }

  const configURL = new URL(`${realtimeURL.toString()}config`);

  try {
    await fetch({
      url: configURL,
      method: "GET",
      headers: {
        Authorization: token.asString(),
      },
      timeoutInMS: 5000,
    });

    return { pollingURL: realtimeURL, realtimeReachable: true };
  } catch {
    logger.log(
      `Can't reach ${realtimeURL.hostname}, make sure it's in your outbound firewall allowlist. Realtime config updates won't be available, switched to polling.`
    );

    return {
      pollingURL: new URL("https://runtime.aikido.dev"),
      realtimeReachable: false,
    };
  }
}
