import { Logger } from "./Logger";

export class LoggerForTesting implements Logger {
  private messages: string[] = [];

  debug(message: string) {
    this.messages.push(message);
  }
  info(message: string) {
    this.messages.push(message);
  }
  warn(message: string) {
    this.messages.push(message);
  }
  error(message: string) {
    this.messages.push(message);
  }

  getMessages() {
    return this.messages;
  }

  clear() {
    this.messages = [];
  }
}
