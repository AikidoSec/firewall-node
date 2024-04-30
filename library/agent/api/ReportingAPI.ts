import { Event } from "./Event";
import { Token } from "./Token";

type ReportingAPIError =
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

export type ReportingAPIResponse =
  | {
      success: true;
      endpoints?: Endpoint[];
      blockedUserIds?: string[];
    }
  | {
      success: false;
      error: ReportingAPIError;
    };

export interface ReportingAPI {
  getConfig(token: Token, timeoutInMS: number): Promise<ReportingAPIResponse>;
  report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<ReportingAPIResponse>;
}
