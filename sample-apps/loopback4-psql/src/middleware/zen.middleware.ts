import { shouldBlockRequest } from "@aikidosec/firewall";
import { HttpErrors, type Middleware } from "@loopback/rest";

export const zenMiddleware: Middleware = async (middlewareCtx, next) => {
  const { request } = middlewareCtx;

  const result = shouldBlockRequest();

  if (result.block) {
    if (result.type === "ratelimited") {
      let message = "You are rate limited by Zen.";
      if (result.trigger === "ip" && result.ip) {
        message += ` (Your IP: ${result.ip})`;
      }

      throw new HttpErrors.TooManyRequests(message);
    }

    if (result.type === "blocked") {
      throw new HttpErrors.Forbidden("You are blocked by Zen.");
    }
  }

  return next();
};
