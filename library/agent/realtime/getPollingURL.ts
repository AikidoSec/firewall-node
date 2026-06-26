export function getPollingURL() {
  if (process.env.AIKIDO_REALTIME_ENDPOINT) {
    return new URL(process.env.AIKIDO_REALTIME_ENDPOINT);
  }

  return new URL("https://runtime.aikido.dev");
}
