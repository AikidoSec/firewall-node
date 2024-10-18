import { shouldBlockRequest } from "./shouldBlockRequest";
import { escapeHTML } from "../helpers/escapeHTML";
import type { Hono } from "hono";

/**
 * Calling this function will setup rate limiting and user blocking for the provided Hono app.
 * Attacks will still be blocked by Zen if you do not call this function.
 * Execute this function as early as possible in your Hono app, but after the middleware that sets the user.
 */
export function setupHonoIntegration(app: Hono) {
  app.use(async (c, next) => {
    const result = shouldBlockRequest();

    if (result.block) {
      if (result.type === "rate-limit") {
        let message = "You are rate limited by Zen.";
        if (result.trigger === "ip" && result.ip) {
          message += ` (Your IP: ${escapeHTML(result.ip)})`;
        }

        return c.text(message, 429);
      }

      if (result.type === "blocked") {
        return c.text("You are blocked by Aikido firewall.", 403);
      }
    }

    await next();
  });
}
