import { getDefaultZenAPIURL } from "../getDefaultZenAPIURL";

export function getRealtimeURL() {
  if (process.env.AIKIDO_REALTIME_ENDPOINT) {
    return new URL(process.env.AIKIDO_REALTIME_ENDPOINT);
  }

  return getDefaultZenAPIURL();
}
