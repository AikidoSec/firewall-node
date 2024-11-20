const { getAppConfig } = require("../zen/config");
module.exports = function getConfig(req, res) {
  if (!req.app) {
    throw new Error("App is missing");
  }

  res.json(getAppConfig(req.app));
};
