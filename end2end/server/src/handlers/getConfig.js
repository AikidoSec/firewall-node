const { getAppConfig } = require("../zen/config");

module.exports = function getConfig(req, res) {
  if (!req.app) {
    throw new Error("App is missing");
  }

  const config = getAppConfig(req.app);
  delete config.failureRate;
  delete config.timeout;
  res.json(config);
};
