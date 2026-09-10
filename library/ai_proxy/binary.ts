import { existsSync } from "node:fs";

/**
 * Resolves the path to the zen-ai-proxy (safechain-l7-proxy, built with the
 * `ai-only` cargo feature) binary.
 *
 * Packaging (bundling a per-platform binary, or downloading one at install
 * time) is future work -- for now this only supports an explicit override,
 * which is what local development and tests use.
 */
export function resolveBinaryPath(): string | undefined {
  const override = process.env.AIKIDO_AI_PROXY_BIN;
  if (override && existsSync(override)) {
    return override;
  }
  return undefined;
}
