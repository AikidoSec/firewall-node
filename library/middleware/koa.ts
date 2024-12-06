import { shouldBlockRequest } from "./shouldBlockRequest";
import { escapeHTML } from "../helpers/escapeHTML";
import type * as Application from "koa";

/**
 * Calling this function will setup rate limiting and user blocking for the provided Express app.
 * Attacks will still be blocked by Zen if you do not call this function.
 * Execute this function as early as possible in your Express app, but after the middleware that sets the user.
 */
export function addKoaMiddleware(app: Application): void {
  app.use(async (ctx, next) => {
    const result = shouldBlockRequest();

    if (result.block) {
      if (result.type === "ratelimited") {
        let message = "You are rate limited by Zen.";
        if (result.trigger === "ip" && result.ip) {
          message += ` (Your IP: ${escapeHTML(result.ip)})`;
        }

        ctx.type = "text/plain";
        ctx.body = message;
        ctx.status = 429;
        return;
      }

      if (result.type === "blocked") {
        ctx.type = "text/plain";
        ctx.body = "You are blocked by Zen.";
        ctx.status = 403;
        return;
      }
    }

    await next();
  });
}
