import { Logger } from "./Logger";

export class LoggerNoop implements Logger {
  debug(message: string) {
    // noop
  }
  info(message: string) {
    // noop
  }
  warn(message: string) {
    // noop
  }
  error(message: string) {
    // noop
  }
}
