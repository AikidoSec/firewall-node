const { getAppConfig } = require("../zen/config");
const { captureEvent: capture } = require("../zen/events");
const { setTimeout } = require("timers/promises");
const { randomInt } = require("crypto");

module.exports = async function captureEvent(req, res) {
  if (!req.app) {
    throw new Error("App is missing");
  }

  // For testing: allow simulating API failures and delays for attack events
  if (req.body.type === "detected_attack") {
    const config = getAppConfig(req.app);

    if (typeof config.failureRate === "number" && config.failureRate > 0) {
      if (Math.random() < config.failureRate) {
        return req.socket.destroy();
      }
    }

    if (typeof config.timeout === "number" && config.timeout > 0) {
      const delay = randomInt(0, config.timeout);
      await setTimeout(delay);
    }
  }

  capture(req.body, req.app);

  if (req.body.type === "detected_attack") {
    return res.json({
      success: true,
    });
  }

  return res.json(getAppConfig(req.app));
};
