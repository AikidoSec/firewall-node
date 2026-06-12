import { shouldBlockRequest } from "./shouldBlockRequest";
import { escapeHTML } from "../helpers/escapeHTML";

/**
 * Adding this handler using app.onBeforeHandle(elysiaHandler) will setup rate limiting and user blocking for the provided Elysia app.
 * Attacks will still be blocked by Zen if you do not add this handler.
 */
export const elysiaHandler: () => Response | void = () => {
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
};
