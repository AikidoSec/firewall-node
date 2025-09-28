import { extractRegionFromToken } from "./extractRegionFromToken";

export function getAPIURL() {
  if (process.env.AIKIDO_ENDPOINT) {
    return new URL(process.env.AIKIDO_ENDPOINT);
  }

  const region = extractRegionFromToken(process.env.AIKIDO_TOKEN || '');

  if (region === 'US') {
    return new URL("https://guard.us.aikido.dev");
  }
  if (region === 'ME') {
    return new URL("https://guard.me.aikido.dev");
  }

  return new URL("https://guard.aikido.dev");
}
