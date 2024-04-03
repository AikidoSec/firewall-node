import { Token } from "./Token";
import { Event } from "./Event";
import { API, APIResult } from "./API";

export class APIForTesting implements API {
  private events: Event[] = [];

  constructor(private result: APIResult = { success: true }) {}

  setResult(result: APIResult) {
    this.result = result;
  }

  async report(token: Token, event: Event) {
    this.events.push(event);

    return this.result;
  }

  clear() {
    this.events = [];
  }

  getEvents() {
    return this.events;
  }
}
