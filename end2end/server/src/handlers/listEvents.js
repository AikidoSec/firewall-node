const { listEvents: list } = require("../zen/events");

function listEvents(req, res) {
  if (!req.app) {
    throw new Error("App is missing");
  }

  res.json(list(req.app));
}

module.exports = listEvents;
