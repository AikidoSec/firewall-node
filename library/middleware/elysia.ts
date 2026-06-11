import { shouldBlockRequest } from "./shouldBlockRequest";
import { escapeHTML } from "../helpers/escapeHTML";
/** TS_EXPECT_TYPES_ERROR_OPTIONAL_DEPENDENCY **/
import type { AnyElysia } from "elysia";

/**
 * Calling this function will setup rate limiting and user blocking for the provided Elysia app.
 * Attacks will still be blocked by Zen if you do not call this function.
 * Execute this function as early as possible in your Elysia app, but after the hook that sets the user.
 */
export function addElysiaPlugin(app: AnyElysia) {
  app.onBeforeHandle(() => {
    const result = shouldBlockRequest();

    if (result.block) {
      if (result.type === "ratelimited") {
        let message = "You are rate limited by Zen.";
        if (result.trigger === "ip" && result.ip) {
          message += ` (Your IP: ${escapeHTML(result.ip)})`;
        }

        return new Response(message, {
          status: 429,
          headers: {
            "Retry-After": result.retryAfterSeconds.toString(),
          },
        });
      }

      if (result.type === "blocked") {
        return new Response("You are blocked by Zen.", { status: 403 });
      }
    }
  });
}
