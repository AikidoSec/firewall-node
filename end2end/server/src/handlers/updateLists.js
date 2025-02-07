const {
  updateBlockedIPAddresses,
  updateBlockedUserAgents,
} = require("../zen/config");

module.exports = function updateIPLists(req, res) {
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

  if (
    !req.body.blockedIPAddresses ||
    !Array.isArray(req.body.blockedIPAddresses)
  ) {
    return res.status(400).json({
      message: "blockedIPAddresses is missing or invalid",
    });
  }

  updateBlockedIPAddresses(req.app, req.body.blockedIPAddresses);

  if (
    req.body.blockedUserAgentsV2 &&
    typeof req.body.blockedUserAgentsV2 === "string"
  ) {
    updateBlockedUserAgents(req.app, req.body.blockedUserAgentsV2);
  }

  res.json({ success: true });
};
