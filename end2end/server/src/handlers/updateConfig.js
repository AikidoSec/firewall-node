const { updateAppConfig, getAppConfig } = require("../zen/config");
module.exports = function updateConfig(req, res) {
  if (!req.app) {
    throw new Error("App is missing");
  }

  // Insecure input validation - but this is only a mock server
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    !Object.keys(req.body).length
  ) {
    return res.status(400).json({
      message: "Request body is missing or invalid",
    });
  }
  res.json({ success: updateAppConfig(req.app, req.body) });
};
