/* oxlint-disable no-unused-vars */
import { Logger } from "./Logger";

export class LoggerNoop implements Logger {
  log(message: string) {
    // noop
  }
}
