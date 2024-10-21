/* eslint-disable import/no-unused-modules */
import isFirewallSupported from "./helpers/isFirewallSupported";
import shouldEnableFirewall from "./helpers/shouldEnableFirewall";
import { setUser } from "./agent/context/user";
import { shouldBlockRequest } from "./middleware/shouldBlockRequest";
import { addExpressMiddleware } from "./middleware/express";
import { addHonoMiddleware } from "./middleware/hono";
import { addHapiMiddleware } from "./middleware/hapi";
import { addFastifyHook } from "./middleware/fastify";

const supported = isFirewallSupported();
const shouldEnable = shouldEnableFirewall();

if (supported && shouldEnable) {
  require("./agent/protect").protect();
}

export {
  setUser,
  shouldBlockRequest,
  addExpressMiddleware,
  addHonoMiddleware,
  addHapiMiddleware,
  addFastifyHook,
};
