export function getRealtimeURL() {
  if (process.env.REALTIME_URL) {
    return new URL(process.env.REALTIME_URL);
  }

  return new URL("https://runtime.aikido.dev");
}
