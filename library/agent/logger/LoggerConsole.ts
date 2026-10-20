import { Logger } from "./Logger";

export class LoggerConsole implements Logger {
  log(message: string) {
    // oxlint-disable-next-line no-console
    console.log(`AIKIDO: ${message}`);
  }
}
