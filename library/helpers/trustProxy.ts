import { envToBool } from "./envToBool";

export function trustProxy() {
  if (!process.env.AIKIDO_TRUST_PROXY) {
    // Trust proxy by default
    // Most of the time, the application is behind a reverse proxy
    return true;
  }

  return envToBool(process.env.AIKIDO_TRUST_PROXY);
}
