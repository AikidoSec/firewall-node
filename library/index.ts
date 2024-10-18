import { setUser } from "./agent/context/user";
import isFirewallSupported from "./helpers/isFirewallSupported";
import shouldEnableFirewall from "./helpers/shouldEnableFirewall";
import { setupExpressIntegration } from "./integrations/express";
import { shouldBlockRequest } from "./integrations/shouldBlockRequest";

const supported = isFirewallSupported();
const shouldEnable = shouldEnableFirewall();

if (supported && shouldEnable) {
  require("./agent/protect").protect();
}

export default {
  setUser,
  shouldBlockRequest,
  setupExpressIntegration,
};
