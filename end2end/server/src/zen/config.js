const configs = [];

function generateConfig(app) {
  return {
    success: true,
    serviceId: app.id,
    configUpdatedAt: app.configUpdatedAt,
    heartbeatIntervalInMS: 10 * 60 * 1000,
    endpoints: [],
    blockedUserIds: [],
    allowedIPAddresses: [],
    receivedAnyStats: true,
  };
}

function getAppConfig(app) {
  const existingConf = configs.find((config) => config.serviceId === app.id);
  if (existingConf) {
    return existingConf;
  }
  const newConf = generateConfig(app);
  configs.push(newConf);
  return newConf;
}

function updateAppConfig(app, newConfig) {
  let index = configs.findIndex((config) => config.serviceId === app.serviceId);
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

const blockedIPAddresses = [];
const blockedUserAgents = [];
const allowedIPAddresses = [];

function updateBlockedIPAddresses(app, ips) {
  let entry = blockedIPAddresses.find((ip) => ip.serviceId === app.serviceId);

  if (entry) {
    entry.ipAddresses = ips;
  } else {
    entry = { serviceId: app.serviceId, ipAddresses: ips };
    blockedIPAddresses.push(entry);
  }

  // Bump lastUpdatedAt
  updateAppConfig(app, {});
}

function getBlockedIPAddresses(app) {
  const entry = blockedIPAddresses.find((ip) => ip.serviceId === app.serviceId);

  if (entry) {
    return entry.ipAddresses;
  }

  return { serviceId: app.serviceId, ipAddresses: [] };
}

function updateAllowedIPAddresses(app, ips) {
  let entry = allowedIPAddresses.find((ip) => ip.serviceId === app.serviceId);

  if (entry) {
    entry.ipAddresses = ips;
  } else {
    entry = { serviceId: app.serviceId, ipAddresses: ips };
    allowedIPAddresses.push(entry);
  }

  // Bump lastUpdatedAt
  updateAppConfig(app, {});
}

function getAllowedIPAddresses(app) {
  const entry = allowedIPAddresses.find((ip) => ip.serviceId === app.serviceId);

  if (entry) {
    return entry.ipAddresses;
  }

  return { serviceId: app.serviceId, ipAddresses: [] };
}

function updateBlockedUserAgents(app, uas) {
  let entry = blockedUserAgents.find((e) => e.serviceId === app.serviceId);

  if (entry) {
    entry.userAgents = uas;
  } else {
    entry = { serviceId: app.serviceId, userAgents: uas };
    blockedUserAgents.push(entry);
  }

  // Bump lastUpdatedAt
  updateAppConfig(app, {});
}

function getBlockedUserAgents(app) {
  const entry = blockedUserAgents.find((e) => e.serviceId === app.serviceId);

  if (entry) {
    return entry.userAgents;
  }

  return { serviceId: app.serviceId, userAgents: [] };
}

module.exports = {
  getAppConfig,
  updateAppConfig,
  updateBlockedIPAddresses,
  getBlockedIPAddresses,
  updateBlockedUserAgents,
  getBlockedUserAgents,
  getAllowedIPAddresses,
  updateAllowedIPAddresses,
};
