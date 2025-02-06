const {
  getBlockedIPAddresses,
  getBlockedUserAgents,
  getOnlyAllowedIPAddresses,
} = require("../zen/config");

module.exports = function lists(req, res) {
  if (!req.app) {
    throw new Error("App is missing");
  }

  const blockedIps = getBlockedIPAddresses(req.app);
  const blockedUserAgents = getBlockedUserAgents(req.app);
  const allowedIps = getOnlyAllowedIPAddresses(req.app);

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
    blockedUserAgents: blockedUserAgents,
    onlyAllowedIPAddresses:
      allowedIps.length > 0
        ? [
            {
              source: "geoip",
              description: "geo restrictions",
              ips: allowedIps,
            },
          ]
        : [],
  });
};
