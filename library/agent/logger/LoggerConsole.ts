/* eslint-disable no-console */
import { Logger } from "./Logger";
import { AikidoLogLevel, shouldLog } from "./logLevel";

export class LoggerConsole implements Logger {
  debug(message: string) {
    if (shouldLog(AikidoLogLevel.debug)) {
      console.debug(`Aikido: ${message}`);
    }
  }
  info(message: string) {
    if (shouldLog(AikidoLogLevel.info)) {
      console.info(`Aikido: ${message}`);
    }
  }
  warn(message: string) {
    if (shouldLog(AikidoLogLevel.warn)) {
      console.warn(`Aikido: ${message}`);
    }
  }
  error(message: string) {
    if (shouldLog(AikidoLogLevel.error)) {
      console.error(`Aikido: ${message}`);
    }
  }
}
