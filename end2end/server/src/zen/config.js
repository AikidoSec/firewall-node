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

module.exports = {
  generateConfig,
};
