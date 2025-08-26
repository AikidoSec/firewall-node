import { shouldBlockRequest } from "./shouldBlockRequest";
import { escapeHTML } from "../helpers/escapeHTML";

/**
 * Calling this function will setup rate limiting and user blocking for the provided Restify server.
 * Attacks will still be blocked by Zen if you do not call this function.
 * Execute this function as early as possible in your Restify server, but after the middleware that sets the user.
 */
export function addRestifyMiddleware(server: any) {
  server.use((req: any, res: any, next: any) => {
    const result = shouldBlockRequest();

    if (result.block) {
      if (result.type === "ratelimited") {
        let message = "You are rate limited by Zen.";
        if (result.trigger === "ip" && result.ip) {
          message += ` (Your IP: ${escapeHTML(result.ip)})`;
        }

        res.status(429);
        res.setHeader("Content-Type", "text/plain");
        res.send(message);

        return next(false);
      }

      if (result.type === "blocked") {
        res.status(403);
        res.setHeader("Content-Type", "text/plain");
        res.send("You are blocked by Zen.");

        return next(false);
      }
    }

    next();
  });
}
