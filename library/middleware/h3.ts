import { shouldBlockRequest } from "./shouldBlockRequest";
/** TS_EXPECT_TYPES_ERROR_OPTIONAL_DEPENDENCY **/
import type { H3Event, App } from "h3";
import { escapeHTML } from "../helpers/escapeHTML";

/**
 * Calling this function will setup rate limiting and user blocking for the provided H3 app.
 * Attacks will still be blocked by Zen if you do not call this function.
 * Execute this function as early as possible in your H3 app, but after the middleware that sets the user.
 */
export function addH3Middleware(app: App) {
  const handler = function zenMiddleware(event: H3Event) {
    const result = shouldBlockRequest();

    if (result.block) {
      if (result.type === "ratelimited") {
        let message = "You are rate limited by Zen.";
        if (result.trigger === "ip" && result.ip) {
          message += ` (Your IP: ${escapeHTML(result.ip)})`;
        }

        event.node.res.statusCode = 429;
        event.node.res.setHeader("content-type", "text/plain");
        return message;
      }

      if (result.type === "blocked") {
        event.node.res.statusCode = 403;
        event.node.res.setHeader("content-type", "text/plain");
        return "You are blocked by Zen.";
      }
    }
  };

  // eslint-disable-next-line camelcase
  handler.__is_handler__ = true;

  // @ts-expect-error Ignore
  app.use(handler);
}
