import { isDebugging } from "../../helpers/isDebugging";

export enum AikidoLogLevel {
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
}

const logLevelKeys = Object.keys(AikidoLogLevel);
const defaultLogLevel = AikidoLogLevel.info;

export function getLogLevel(): AikidoLogLevel {
  // Check for AIKIDO_DEBUG environment variable
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
