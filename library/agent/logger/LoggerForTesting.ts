import { Logger } from "./Logger";

export class LoggerForTesting implements Logger {
  private messages: string[] = [];

  log(message: string) {
    this.messages.push(message);
  }

  getMessages() {
    return this.messages;
  }

  clear() {
    this.messages = [];
  }
}
