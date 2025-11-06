const { createApp: create, getByToken } = require("../zen/apps");
const { updateAppConfig } = require("../zen/config");

module.exports = function createApp(req, res) {
  const token = create();

  // Support optional config parameters for testing
  if (req.body) {
    const app = getByToken(token);
    if (app) {
      const testConfig = {};

      if (typeof req.body.failureRate === "number") {
        testConfig.failureRate = req.body.failureRate;
      }

      if (typeof req.body.timeout === "number") {
        testConfig.timeout = req.body.timeout;
      }

      if (Object.keys(testConfig).length > 0) {
        updateAppConfig(app, testConfig);
      }
    }
  }

  res.json({
    token: token,
  });
};
