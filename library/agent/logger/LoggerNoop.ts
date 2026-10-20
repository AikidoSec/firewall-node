import { Logger } from "./Logger";

export class LoggerNoop implements Logger {
  log(_message: string) {
    // noop
  }
}
