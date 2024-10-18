import type { Express } from "express";
import { shouldBlockRequest } from "./shouldBlockRequest";
import { escapeHTML } from "../helpers/escapeHTML";

/**
 * Calling this function will setup rate limiting and user blocking for the provided Express app.
 * Attacks will still be blocked by Zen if you do not call this function.
 * Execute this function as early as possible in your Express app, but after the middleware that sets the user.
 */
export function setupExpressIntegration(app: Express) {
  app.use((req, res, next) => {
    const result = shouldBlockRequest();

    if (result.block) {
      if (result.type === "ratelimited") {
        let message = "You are rate limited by Zen.";
        if (result.trigger === "ip" && result.ip) {
          message += ` (Your IP: ${escapeHTML(result.ip)})`;
        }

        return res.status(429).type("text").send(message);
      }

      if (result.type === "blocked") {
        return res
          .status(403)
          .type("text")
          .send("You are blocked by Aikido Zen.");
      }
    }

    next();
  });
}
