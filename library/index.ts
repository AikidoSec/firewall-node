/* eslint-disable no-console */
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
import { isESM } from "./helpers/isESM";
import { addH3Middleware } from "./middleware/h3";

const supported = isFirewallSupported();
const shouldEnable = shouldEnableFirewall();

if (supported && shouldEnable) {
  if (isESM()) {
    console.warn(
      "AIKIDO: Your application seems to be running in ESM mode. Zen does not support ESM at runtime yet."
    );
  }

  require("./agent/protect").protect();
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
  addH3Middleware,
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
  addH3Middleware,
};
