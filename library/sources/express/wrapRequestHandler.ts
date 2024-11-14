import type { RequestHandler } from "express";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { contextFromRequest } from "./contextFromRequest";
import { shouldRateLimitRequest } from "../../ratelimiting/shouldRateLimitRequest";

export function wrapRequestHandler(
  handler: RequestHandler,
  agent: Agent
): RequestHandler {
  const fn: RequestHandler = (req, res, next) => {
    const context = contextFromRequest(req);

    return runWithContext(context, () => {
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      if (!context) {
        return handler(req, res, next);
      }

      if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
        return res.status(403).send("You are blocked by Aikido firewall.");
      }

      const result = shouldRateLimitRequest(context, agent);

      if (result.block) {
        let message = "You are rate limited by Aikido firewall.";
        if (result.trigger === "ip") {
          message += ` (Your IP: ${escapeHTML(context.remoteAddress!)})`;
        }

        return res.status(429).send(message);
      }

      return handler(req, res, next);
    });
  };

  if (handler.name) {
    preserveFunctionName(fn, handler.name);
  }

  return fn;
}

/**
 * Preserve the original function name
 * e.g. Ghost looks up a middleware function by name in the router stack
 *
 * Object.getOwnPropertyDescriptor(function myFunction() {}, "name")
 *
 * {
 *   value: 'myFunction',
 *   writable: false,
 *   enumerable: false,
 *   configurable: true
 * }
 */
function preserveFunctionName(wrappedFunction: Function, originalName: string) {
  try {
    Object.defineProperty(wrappedFunction, "name", {
      value: originalName,
      writable: false,
      enumerable: false,
      configurable: true,
    });
  } catch (e) {
    // Ignore
  }
}
