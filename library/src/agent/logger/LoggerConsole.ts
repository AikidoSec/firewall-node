import { Logger } from "./Logger";

export class LoggerConsole implements Logger {
  log(message: string) {
    // eslint-disable-next-line no-console
    console.log(`AIKIDO: ${message}`);
  }
}
