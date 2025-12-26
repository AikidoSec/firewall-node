import type { App } from "./apps.ts";

type AppConfig = {
  success: boolean;
  serviceId: number;
  configUpdatedAt: number;
  heartbeatIntervalInMS: number;
  endpoints: any[];
  blockedUserIds: number[];
  allowedIPAddresses: string[];
  receivedAnyStats: boolean;
  blockNewOutgoingRequests: boolean;
  domains: any[];
  failureRate?: number;
  timeout?: number;
};

const configs: AppConfig[] = [];

export function generateConfig(app: App): AppConfig {
  return {
    success: true,
    serviceId: app.id,
    configUpdatedAt: app.configUpdatedAt,
    heartbeatIntervalInMS: 10 * 60 * 1000,
    endpoints: [],
    blockedUserIds: [],
    allowedIPAddresses: [],
    blockNewOutgoingRequests: false,
    domains: [],
  };
}

export function getAppConfig(app: App) {
  const existingConf = configs.find((config) => config.serviceId === app.id);
  if (existingConf) {
    return existingConf;
  }
  const newConf = generateConfig(app);
  configs.push(newConf);
  return newConf;
}

export function updateAppConfig(app: App, newConfig: Partial<AppConfig>) {
  let index = configs.findIndex((config) => config.serviceId === app.id);
  if (index === -1) {
    getAppConfig(app);
    index = configs.length - 1;
  }
  configs[index] = {
    ...configs[index],
    ...newConfig,
    configUpdatedAt: Date.now(),
  };
  return true;
}

const blockedIPAddresses: { serviceId: number; ipAddresses: string[] }[] = [];
const blockedUserAgents: { serviceId: number; userAgents: string[] }[] = [];
const allowedIPAddresses: { serviceId: number; ipAddresses: string[] }[] = [];
const monitoredUserAgents: { serviceId: number; userAgents: string[] }[] = [];
const monitoredIPAddresses: { serviceId: number; ipAddresses: string[] }[] = [];
const userAgentDetails: { serviceId: number; userAgents: string[] }[] = [];

export function updateBlockedIPAddresses(app: App, ips: string[]) {
  let entry = blockedIPAddresses.find((ip) => ip.serviceId === app.id);

  if (entry) {
    entry.ipAddresses = ips;
  } else {
    entry = { serviceId: app.id, ipAddresses: ips };
    blockedIPAddresses.push(entry);
  }

  // Bump lastUpdatedAt
  updateAppConfig(app, {});
}

export function getBlockedIPAddresses(app: App) {
  const entry = blockedIPAddresses.find((ip) => ip.serviceId === app.id);

  if (entry) {
    return entry.ipAddresses;
  }

  return [];
}

export function updateAllowedIPAddresses(app: App, ips: string[]) {
  let entry = allowedIPAddresses.find((ip) => ip.serviceId === app.id);

  if (entry) {
    entry.ipAddresses = ips;
  } else {
    entry = { serviceId: app.id, ipAddresses: ips };
    allowedIPAddresses.push(entry);
  }

  // Bump lastUpdatedAt
  updateAppConfig(app, {});
}

export function getAllowedIPAddresses(app: App) {
  const entry = allowedIPAddresses.find((ip) => ip.serviceId === app.id);

  if (entry) {
    return entry.ipAddresses;
  }

  return [];
}
export function updateBlockedUserAgents(app: App, uas: string[]) {
  let entry = blockedUserAgents.find((e) => e.serviceId === app.id);

  if (entry) {
    entry.userAgents = uas;
  } else {
    entry = { serviceId: app.id, userAgents: uas };
    blockedUserAgents.push(entry);
  }

  // Bump lastUpdatedAt
  updateAppConfig(app, {});
}

export function getBlockedUserAgents(app: App) {
  const entry = blockedUserAgents.find((e) => e.serviceId === app.id);

  if (entry) {
    return entry.userAgents;
  }

  return "";
}

export function updateMonitoredUserAgents(app: App, uas: string[]) {
  let entry = monitoredUserAgents.find((e) => e.serviceId === app.id);

  if (entry) {
    entry.userAgents = uas;
  } else {
    entry = { serviceId: app.id, userAgents: uas };
    monitoredUserAgents.push(entry);
  }

  // Bump lastUpdatedAt
  updateAppConfig(app, {});
}

export function getMonitoredUserAgents(app: App) {
  const entry = monitoredUserAgents.find((e) => e.serviceId === app.id);

  if (entry) {
    return entry.userAgents;
  }

  return "";
}

export function updateMonitoredIPAddresses(app: App, ips: string[]) {
  let entry = monitoredIPAddresses.find((e) => e.serviceId === app.id);

  if (entry) {
    entry.ipAddresses = ips;
  } else {
    entry = { serviceId: app.id, ipAddresses: ips };
    monitoredIPAddresses.push(entry);
  }

  // Bump lastUpdatedAt
  updateAppConfig(app, {});
}

export function getMonitoredIPAddresses(app: App) {
  const entry = monitoredIPAddresses.find((e) => e.serviceId === app.id);

  if (entry) {
    return entry.ipAddresses;
  }

  return [];
}

export function updateUserAgentDetails(app: App, uas: string[]) {
  let entry = userAgentDetails.find((e) => e.serviceId === app.id);

  if (entry) {
    entry.userAgents = uas;
  } else {
    entry = { serviceId: app.id, userAgents: uas };
    userAgentDetails.push(entry);
  }

  // Bump lastUpdatedAt
  updateAppConfig(app, {});
}

export function getUserAgentDetails(app: App) {
  const entry = userAgentDetails.find((e) => e.serviceId === app.id);

  if (entry) {
    return entry.userAgents;
  }

  return [];
}
