const {
  getBlockedIPAddresses,
  getBlockedUserAgents,
  getAllowedIPAddresses,
  getBotSpoofingData,
  getMonitoredUserAgents,
  getMonitoredIPAddresses,
  getUserAgentDetails,
} = require("../zen/config");

module.exports = function lists(req, res) {
  if (!req.app) {
    throw new Error("App is missing");
  }

  const blockedIps = getBlockedIPAddresses(req.app);
  const blockedUserAgents = getBlockedUserAgents(req.app);
  const allowedIps = getAllowedIPAddresses(req.app);
  const botSpoofingData = getBotSpoofingData(req.app);
  const monitoredUserAgents = getMonitoredUserAgents(req.app);
  const monitoredIps = getMonitoredIPAddresses(req.app);
  const userAgentDetails = getUserAgentDetails(req.app);

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
            },
          ]
        : [],
    blockedUserAgents: blockedUserAgents,
    monitoredUserAgents: monitoredUserAgents,
    userAgentDetails: userAgentDetails,
    allowedIPAddresses:
      allowedIps.length > 0
        ? [
            {
              key: "geoip/Belgium;BE",
              source: "geoip",
              description: "geo restrictions",
              ips: allowedIps,
            },
          ]
        : [],
    botSpoofingProtection: botSpoofingData,
    monitoredIPAddresses:
      monitoredIps.length > 0
        ? monitoredIps
        : [
            {
              key: "geoip/Belgium;BE",
              source: "geoip",
              description: "geo restrictions",
              ips: monitoredIps,
            },
          ],
  });
};
