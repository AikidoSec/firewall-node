import { Token } from "./Token";
import { Event } from "./Event";
import { API } from "./API";

export class APIForTesting implements API {
  private readonly events: Event[] = [];

  async report(token: Token, event: Event) {
    this.events.push(event);
  }

  getEvents() {
    return this.events;
  }
}
