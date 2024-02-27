import { Event } from "./Event";
import { Token } from "./Token";

export interface API {
  report(token: Token, event: Event): Promise<void>;
}
