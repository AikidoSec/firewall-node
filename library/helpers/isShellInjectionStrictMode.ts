import { envToBool } from "./envToBool";

/**
 * Check if the shell injection strict mode is enabled via environment variable.
 * When enabled, Zen uses the WASM-based shell injection detection and rejects non-/bin/sh shells.
 * - AIKIDO_SHELL_INJECTION_STRICT_MODE=true or AIKIDO_SHELL_INJECTION_STRICT_MODE=1
 */
export function isShellInjectionStrictMode(): boolean {
  return envToBool(process.env.AIKIDO_SHELL_INJECTION_STRICT_MODE);
}
