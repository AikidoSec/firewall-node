/* eslint-disable import/no-unused-modules */
import isFirewallSupported from "./helpers/isFirewallSupported";
import shouldEnableFirewall from "./helpers/shouldEnableFirewall";

const supported = isFirewallSupported();
const shouldEnable = shouldEnableFirewall();

if (supported && shouldEnable) {
  require("./agent/protect").protect();
}

import { setUser } from "./agent/context/user";
import { setupExpressIntegration } from "./integrations/express";
import { shouldBlockRequest } from "./integrations/shouldBlockRequest";
import { setupHonoIntegration } from "./integrations/hono";
import { setupHapiIntegration } from "./integrations/hapi";

export {
  setUser,
  shouldBlockRequest,
  setupExpressIntegration,
  setupHonoIntegration,
  setupHapiIntegration,
};
