import type { Server } from "@hapi/hapi";
import { shouldBlockRequest } from "./shouldBlockRequest";

/**
 * Calling this function will setup rate limiting and user blocking for the provided Hapi app.
 * Attacks will still be blocked by Zen if you do not call this function.
 * Execute this function as early as possible in your Hapi app, but after the middleware that sets the user.
 */
export function setupHapiIntegration(app: Server) {
  app.ext("onRequest", function onRequest(request, h) {
    const result = shouldBlockRequest();
    if (result.block) {
      if (result.type === "ratelimited") {
        let message = "You are rate limited by Zen.";
        if (result.trigger === "ip" && result.ip) {
          message += ` (Your IP: ${result.ip})`;
        }

        return h.response(message).code(429).takeover();
      }

      if (result.type === "blocked") {
        return h.response("You are blocked by Zen.").code(403).takeover();
      }
    }

    return h.continue;
  });
}
