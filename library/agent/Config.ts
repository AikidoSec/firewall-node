export type Endpoint = {
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

export type Config = {
  endpoints: Endpoint[];
  heartbeatIntervalInMS: number;
  configUpdatedAt: number;
  blockedUserIds: string[];
  allowedIPAddresses: string[];
  block?: boolean;
  receivedAnyStats?: boolean;
  blockedIpAddresses?: string[];
};
