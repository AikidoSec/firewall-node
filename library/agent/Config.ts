export type Endpoint = {
  method: string;
  route: string;
  forceProtectionOff: boolean;
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
};
