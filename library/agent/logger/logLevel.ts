import { isDebugging } from "../../helpers/isDebugging";

export const AikidoLogLevel = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
} as const;

type AikidoLogLevel = (typeof AikidoLogLevel)[keyof typeof AikidoLogLevel];

const logLevelKeys = Object.keys(AikidoLogLevel);
const defaultLogLevel = AikidoLogLevel.info;

export function getLogLevel(): AikidoLogLevel {
  // Check for AIKIDO_DEBUG environment variable (backwards compat)
  if (isDebugging()) {
    return AikidoLogLevel.debug;
  }

  const envValue = process.env.AIKIDO_LOG_LEVEL;
  if (envValue && logLevelKeys.includes(envValue)) {
    return AikidoLogLevel[envValue as keyof typeof AikidoLogLevel];
  }

  return defaultLogLevel;
}

export function shouldLog(messageLogLevel: AikidoLogLevel) {
  const currentLogLevel = getLogLevel();
  return messageLogLevel >= currentLogLevel;
}
