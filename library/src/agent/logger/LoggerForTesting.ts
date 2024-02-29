import { Logger } from "./Logger";

export class LoggerForTesting implements Logger {
  private readonly messages: string[] = [];

  log(message: string) {
    this.messages.push(message);
  }

  getMessages() {
    return this.messages;
  }
}
