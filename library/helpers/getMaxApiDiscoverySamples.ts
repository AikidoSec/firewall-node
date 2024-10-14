const MAX_API_DISCOVERY_SAMPLES = 10;

export function getMaxApiDiscoverySamples() {
  if (process.env.AIKIDO_MAX_API_DISCOVERY_SAMPLES) {
    const parsed = parseInt(process.env.AIKIDO_MAX_API_DISCOVERY_SAMPLES, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return MAX_API_DISCOVERY_SAMPLES;
}
