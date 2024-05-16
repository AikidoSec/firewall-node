import { Config } from "../Config";
import { Event } from "./Event";
import { Token } from "./Token";

type ReportingAPIError =
  | "timeout"
  | "unknown_error"
  | "rate_limited"
  | "max_attacks_reached"
  | "invalid_token";

export type ReportingAPIResponse =
  | ({
      success: true;
    } & Config)
  | {
      success: false;
      error: ReportingAPIError;
    };

export interface ReportingAPI {
  report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<ReportingAPIResponse>;
}
