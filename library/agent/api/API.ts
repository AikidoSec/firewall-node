import { Event } from "./Event";
import { Token } from "./Token";

type APIError =
  | "timeout"
  | "unknown_error"
  | "rate_limited"
  | "max_attacks_reached"
  | "invalid_token";

export type APIResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: APIError;
    };

export interface API {
  report(token: Token, event: Event, timeoutInMS: number): Promise<APIResult>;
}
