export type Endpoint = {
  method: string;
  route: string;
  forceProtectionOff: boolean;
};

export type Config = {
  endpoints: Endpoint[];
  heartbeatIntervalInMS: number;
  configUpdatedAt: number;
  blockedUserIds: string[];
};
