import { isUnitTest } from "./isUnitTest";

const envPrefix = "AIKIDO_FEATURE_";

/**
 * Check if a feature that is behind a feature flag is enabled
 * This function is case-insensitive.
 * All feature flags are enabled by default in unit tests (using tap).
 */
export function isFeatureEnabled(feature: string): boolean {
  // Always enable features in tests / ci
  if (isUnitTest()) {
    return true;
  }

  const envVar = `${envPrefix}${feature.toUpperCase()}`;

  return process.env[envVar] === "true" || process.env[envVar] === "1";
}
