import type { IPMatcher } from "../helpers/ip-matcher/IPMatcher";

export type EndpointConfig = {
  method: string;
  route: string;
  forceProtectionOff: boolean;
  graphql?: {
    type: "query" | "mutation";
    name: string;
  };
  allowedIPAddresses?: string[];
  rateLimiting: {
    enabled: boolean;
    maxRequests: number;
    windowSizeInMS: number;
  };
};

export type Endpoint = Omit<EndpointConfig, "allowedIPAddresses"> & {
  allowedIPAddresses: IPMatcher | undefined;
};

export type Domain = { hostname: string; mode: "allow" | "block" };

export type Config = {
  endpoints: EndpointConfig[];
  heartbeatIntervalInMS: number;
  configUpdatedAt: number;
  blockedUserIds: string[];
  allowedIPAddresses: string[];
  block?: boolean;
  blockNewOutgoingRequests?: boolean;
  domains?: Domain[];
};
