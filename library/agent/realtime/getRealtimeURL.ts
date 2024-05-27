export function getRealtimeURL() {
  if (process.env.AIKIDO_REALTIME_URL) {
    return new URL(process.env.AIKIDO_REALTIME_URL);
  }

  return new URL("https://runtime.aikido.dev");
}
