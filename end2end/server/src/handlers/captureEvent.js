const { getAppConfig } = require("../zen/config");
const { captureEvent: capture } = require("../zen/events");

module.exports = function captureEvent(req, res) {
  if (!req.app) {
    throw new Error("App is missing");
  }

  capture(req.body, req.app);

  if (req.body.type === "detected_attack") {
    return res.json({
      success: true,
    });
  }

  return res.json(getAppConfig(req.app));
};
