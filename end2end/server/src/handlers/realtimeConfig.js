const { getAppConfig } = require("../zen/config");

module.exports = function realtimeConfig(req, res) {
  if (!req.app) {
    throw new Error("App is missing");
  }

  const config = getAppConfig(req.app);

  res.json({
    serviceId: req.app.serviceId,
    configUpdatedAt: config.configUpdatedAt,
  });
};
