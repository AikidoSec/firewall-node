export function isUsingTurbopack(): boolean {
  if (process.env.TURBOPACK !== undefined || process.argv.includes("--turbo")) {
    return true;
  }

  // Next.js standalone production builds embed the full config in this env var
  const standaloneConfig = process.env.__NEXT_PRIVATE_STANDALONE_CONFIG;
  if (standaloneConfig) {
    try {
      const config = JSON.parse(standaloneConfig) as Record<string, unknown>;
      return config.turbopack !== undefined;
    } catch {
      return false;
    }
  }

  return false;
}
