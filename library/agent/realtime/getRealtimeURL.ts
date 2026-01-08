import { extractRegionFromToken } from "../extractRegionFromToken";

export function getRealtimeURL() {
  if (process.env.AIKIDO_REALTIME_ENDPOINT) {
    return new URL(process.env.AIKIDO_REALTIME_ENDPOINT);
  }

  const region = extractRegionFromToken(process.env.AIKIDO_TOKEN || "");

  if (region === "US") {
    return new URL("https://runtime.us.aikido.dev");
  }

  if (region === "ME") {
    return new URL("https://runtime.me.aikido.dev");
  }

  return new URL("https://runtime.aikido.dev");
}
