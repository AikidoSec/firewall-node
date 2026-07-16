import { extractRegionFromToken } from "./extractRegionFromToken";

export function getDefaultZenAPIURL() {
  const region = extractRegionFromToken(process.env.AIKIDO_TOKEN || "");

  if (region === "US") {
    return new URL("https://guard.us.aikido.dev");
  }

  if (region === "ME") {
    return new URL("https://guard.me.aikido.dev");
  }

  if (region === "AU") {
    return new URL("https://guard.au.aikido.dev");
  }

  return new URL("https://guard.aikido.dev");
}
