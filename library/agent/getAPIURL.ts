export function getAPIURL() {
  if (process.env.AIKIDO_URL) {
    return new URL(process.env.AIKIDO_URL);
  }

  return new URL("https://guard.aikido.dev");
}
