import { isDebugging } from "../../helpers/isDebugging";

const logLevels = ["debug", "info", "warn", "error"] as const;
const defaultLogLevel: AikidoLogLevel = "info";

type AikidoLogLevel = (typeof logLevels)[number];

export function getLogLevel(): AikidoLogLevel {
  // Check for AIKIDO_DEBUG environment variable
  if (isDebugging()) {
    return "debug";
  }

  const envValue = process.env.AIKIDO_LOG_LEVEL;
  if (envValue && logLevels.includes(envValue as any)) {
    return envValue as AikidoLogLevel;
  }

  return defaultLogLevel;
}
