import { API, APIResult } from "./API";
import { Token } from "./Token";
import { Event } from "./Event";

export class APIThatThrows implements API {
  async report(token: Token, event: Event): Promise<APIResult> {
    throw new Error("Failed to report event");
  }
}
