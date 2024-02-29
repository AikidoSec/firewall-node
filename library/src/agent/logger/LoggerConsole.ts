import { Logger } from "./Logger";

export class LoggerConsole implements Logger {
  /**
   * Creates a terminal log with the "AIKIDO: " affix.
   * @param message Message to be logged
   */
  log(message: string) {
    console.log(`AIKIDO: ${message}`);
  }
}
