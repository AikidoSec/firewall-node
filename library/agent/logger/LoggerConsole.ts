/* eslint-disable no-console */
import { Logger } from "./Logger";

export class LoggerConsole implements Logger {
  debug(message: string) {
    console.debug(`Aikido: ${message}`);
  }
  info(message: string) {
    console.info(`Aikido: ${message}`);
  }
  warn(message: string) {
    console.warn(`Aikido: ${message}`);
  }
  error(message: string) {
    console.error(`Aikido: ${message}`);
  }
}
