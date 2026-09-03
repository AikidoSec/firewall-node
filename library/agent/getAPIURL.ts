import { getDefaultZenAPIURL } from "./getDefaultZenAPIURL";

export function getAPIURL() {
  if (process.env.AIKIDO_ENDPOINT) {
    return new URL(process.env.AIKIDO_ENDPOINT);
  }

  return getDefaultZenAPIURL();
}
