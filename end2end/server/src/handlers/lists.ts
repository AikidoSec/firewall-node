import {
  getBlockedIPAddresses,
  getBlockedUserAgents,
  getAllowedIPAddresses,
  getMonitoredUserAgents,
  getMonitoredIPAddresses,
  getUserAgentDetails,
} from "../zen/config.ts";
import type { Response } from "express";
import type { ZenRequest } from "../types.ts";

export function lists(req: ZenRequest, res: Response) {
  if (!req.zenApp) {
    throw new Error("App is missing");
  }

  // Check if Accept-Encoding header contains 'gzip'
  const acceptEncoding = req.get("accept-encoding") || "";
  if (!acceptEncoding.toLowerCase().includes("gzip")) {
    return res.status(400).json({
      success: false,
      error:
        "Accept-Encoding header must include 'gzip' for firewall lists endpoint",
    });
  }

  const blockedIps = getBlockedIPAddresses(req.zenApp);
  const blockedUserAgents = getBlockedUserAgents(req.zenApp);
  const allowedIps = getAllowedIPAddresses(req.zenApp);
  const monitoredUserAgents = getMonitoredUserAgents(req.zenApp);
  const monitoredIps = getMonitoredIPAddresses(req.zenApp);
  const userAgentDetails = getUserAgentDetails(req.zenApp);

  res.json({
    success: true,
    serviceId: req.zenApp.id,
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
}
