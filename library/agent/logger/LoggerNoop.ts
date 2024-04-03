import { Logger } from "./Logger";

export class LoggerNoop implements Logger {
  log(message: string) {
    // noop
  }
}
