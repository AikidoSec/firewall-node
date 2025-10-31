/* eslint-disable no-console */
import isFirewallSupported from "./helpers/isFirewallSupported";
import shouldEnableFirewall from "./helpers/shouldEnableFirewall";
import { setUser } from "./agent/context/user";
import { markUnsafe } from "./agent/context/markUnsafe";
import { shouldBlockRequest } from "./middleware/shouldBlockRequest";
import { addExpressMiddleware } from "./middleware/express";
import { addHonoMiddleware } from "./middleware/hono";
import { addHapiMiddleware } from "./middleware/hapi";
import { addFastifyHook, fastifyHook } from "./middleware/fastify";
import { addKoaMiddleware } from "./middleware/koa";
import { addRestifyMiddleware } from "./middleware/restify";
import { isESM } from "./helpers/isESM";
import { checkIndexImportGuard } from "./helpers/indexImportGuard";
import { setRateLimitGroup } from "./ratelimiting/group";
import { isLibBundled } from "./helpers/isLibBundled";
import { addHook, removeHook } from "./agent/hooks";

const supported = isFirewallSupported();
const shouldEnable = shouldEnableFirewall();
const notAlreadyImported = checkIndexImportGuard();

if (supported && shouldEnable && notAlreadyImported) {
  if (isESM()) {
    console.warn(
      "AIKIDO: Your application seems to be running in ESM mode. Zen does not support ESM at runtime yet."
    );
  }

  if (isLibBundled()) {
    console.warn(
      "AIKIDO: Your application seems to be using a bundler without externalizing Zen and the packages that should be protected. Zen will not function as intended. See https://github.com/AikidoSec/firewall-node/blob/main/docs/bundler.md for more information."
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
  fastifyHook,
  addKoaMiddleware,
  addRestifyMiddleware,
  setRateLimitGroup,
  addHook,
  removeHook,
};

// Required for ESM / TypeScript default export support
// e.g. import Zen from '@aikidosec/firewall'; would not work without this, as Zen.setUser would be undefined
export default {
  setUser,
  markUnsafe,
  shouldBlockRequest,
  addExpressMiddleware,
  addHonoMiddleware,
  addHapiMiddleware,
  addFastifyHook,
  fastifyHook,
  addKoaMiddleware,
  addRestifyMiddleware,
  setRateLimitGroup,
  addHook,
  removeHook,
};
