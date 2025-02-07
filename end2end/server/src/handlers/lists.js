const {
  getBlockedIPAddresses,
  getBlockedUserAgents,
} = require("../zen/config");

module.exports = function lists(req, res) {
  if (!req.app) {
    throw new Error("App is missing");
  }

  const blockedIps = getBlockedIPAddresses(req.app);
  const blockedUserAgents = getBlockedUserAgents(req.app);

  res.json({
    success: true,
    serviceId: req.app.id,
    blockedIPAddresses:
      blockedIps.length > 0
        ? [
            {
              source: "geoip",
              description: "geo restrictions",
              ips: blockedIps,
            },
          ]
        : [],
    blockedUserAgentsV2: Array.isArray(blockedUserAgents)
      ? blockedUserAgents
      : [],
  });
};
