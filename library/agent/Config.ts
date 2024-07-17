export type Endpoint = {
  method: string;
  route: string;
  forceProtectionOff: boolean;
  graphql?: {
    fields: {
      type: "query" | "mutation";
      name: string;
      rateLimiting: {
        enabled: boolean;
        maxRequests: number;
        windowSizeInMS: number;
      };
    }[];
  };
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
};
