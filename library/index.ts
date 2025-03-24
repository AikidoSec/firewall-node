/* eslint-disable import/no-unused-modules */
import isFirewallSupported from "./helpers/isFirewallSupported";
import shouldEnableFirewall from "./helpers/shouldEnableFirewall";
import { setUser } from "./agent/context/user";
import { markUnsafe } from "./agent/context/markUnsafe";
import { shouldBlockRequest } from "./middleware/shouldBlockRequest";
import { addExpressMiddleware } from "./middleware/express";
import { addHonoMiddleware } from "./middleware/hono";
import { addHapiMiddleware } from "./middleware/hapi";
import { addFastifyHook } from "./middleware/fastify";
import { addKoaMiddleware } from "./middleware/koa";
import { isNewHookSystemUsed } from "./agent/isNewHookSystemUsed";

// Prevent logging twice / trying to start agent twice
if (!isNewHookSystemUsed()) {
  const supported = isFirewallSupported();
  const shouldEnable = shouldEnableFirewall();

  if (supported && shouldEnable) {
    require("./agent/protect").protect();
  }
}

export {
  setUser,
  markUnsafe,
  shouldBlockRequest,
  addExpressMiddleware,
  addHonoMiddleware,
  addHapiMiddleware,
  addFastifyHook,
  addKoaMiddleware,
};

// Required for ESM / TypeScript default export support
// e.g. import Zen from '@aikidosec/firewall'; would not work without this, as Zen.setUser would be undefined
export default {
  setUser,
  shouldBlockRequest,
  addExpressMiddleware,
  addHonoMiddleware,
  addHapiMiddleware,
  addFastifyHook,
  addKoaMiddleware,
};
