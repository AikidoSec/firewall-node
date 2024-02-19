/**
 * Exports 2 classes related to logging
 * + Type definition Logger
 * @module Logger
 */

export interface Logger {
  log(message: string): void;
}

/**
 * A console class that has the log function
 * @class LoggerConsole
 */
export class LoggerConsole {
  /**
   * Creates a terminal log with the "AIKIDO: " affix.
   * @param message Message to be logged
   */
  log(message: string) {
    console.log(`AIKIDO: ${message}`);
  }
}

export class LoggerNoop {
  log(message: string) {
    // noop
  }
}
