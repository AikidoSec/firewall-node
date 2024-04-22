import { Event } from "./Event";
import { Token } from "./Token";

type APIError =
  | "timeout"
  | "unknown_error"
  | "rate_limited"
  | "max_attacks_reached"
  | "invalid_token";

export type Endpoint = {
  method: string;
  route: string;
  forceProtectionOff: boolean;
};

export type APIResult =
  | {
      success: true;
      endpoints?: Endpoint[];
    }
  | {
      success: false;
      error: APIError;
    };

export interface API {
  report(token: Token, event: Event, timeoutInMS: number): Promise<APIResult>;
}
