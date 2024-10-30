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
  configs[index] = { ...configs[index], ...newConfig };
  return true;
}

module.exports = {
  getAppConfig,
  updateAppConfig,
};
