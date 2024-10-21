/* eslint-disable import/no-unused-modules */
import isFirewallSupported from "./helpers/isFirewallSupported";
import shouldEnableFirewall from "./helpers/shouldEnableFirewall";

const supported = isFirewallSupported();
const shouldEnable = shouldEnableFirewall();

if (supported && shouldEnable) {
  require("./agent/protect").protect();
}

import { setUser } from "./agent/context/user";
import { shouldBlockRequest } from "./middleware/shouldBlockRequest";
import { addExpressMiddleware } from "./middleware/express";
import { addHonoMiddleware } from "./middleware/hono";
import { addHapiMiddleware } from "./middleware/hapi";

export {
  setUser,
  shouldBlockRequest,
  addExpressMiddleware,
  addHonoMiddleware,
  addHapiMiddleware,
};
