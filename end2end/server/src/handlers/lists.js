const {
  getBlockedIPAddresses,
  getBlockedUserAgents,
  getAllowedIPAddresses,
} = require("../zen/config");

module.exports = function lists(req, res) {
  if (!req.app) {
    throw new Error("App is missing");
  }

  const blockedIps = getBlockedIPAddresses(req.app);
  const blockedUserAgents = getBlockedUserAgents(req.app);
  const allowedIps = getAllowedIPAddresses(req.app);

  res.json({
    success: true,
    serviceId: req.app.id,
    blockedIPAddresses:
      blockedIps.length > 0
        ? [
            {
              key: "geoip/Belgium;BE",
              source: "geoip",
              description: "geo restrictions",
              ips: blockedIps,
              monitor: false,
            },
          ]
        : [],
    blockedUserAgents:
      blockedUserAgents.length > 0
        ? [
            {
              key: "hackers",
              pattern: blockedUserAgents,
              monitor: false,
            },
          ]
        : [],
    allowedIPAddresses:
      allowedIps.length > 0
        ? [
            {
              key: "geoip/Belgium;BE",
              source: "geoip",
              description: "geo restrictions",
              ips: allowedIps,
              monitor: false,
            },
          ]
        : [],
    monitoredIPAddresses: [],
    monitoredUserAgents: [],
  });
};
