const {
  updateBlockedIPAddresses,
  updateBlockedUserAgents,
  updateAllowedIPAddresses,
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
    req.body.blockedUserAgents &&
    typeof req.body.blockedUserAgents === "string"
  ) {
    updateBlockedUserAgents(req.app, req.body.blockedUserAgents);
  }

  if (
    req.body.allowedIPAddresses &&
    Array.isArray(req.body.allowedIPAddresses)
  ) {
    updateAllowedIPAddresses(req.app, req.body.allowedIPAddresses);
  }

  res.json({ success: true });
};
