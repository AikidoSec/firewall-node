/* oxlint-disable no-console */

import { getInstance } from "../agent/AgentSingleton";
import { getContext, updateContext } from "../agent/Context";
import { shouldRateLimitRequest } from "../ratelimiting/shouldRateLimitRequest";
import { evaluateWafRules } from "../waf/waf";

type Result = {
  block: boolean;
  type?: "ratelimited" | "blocked" | "waf";
  trigger?: "ip" | "user" | "group" | "waf";
  ip?: string;
};

export function shouldBlockRequest(): Result {
  const context = getContext();
  if (!context) {
    logWarningShouldBlockRequestCalledWithoutContext();
    return { block: false };
  }

  const agent = getInstance();
  if (!agent) {
    return { block: false };
  }

  if (agent.isServerless()) {
    logWarningServerlessNotSupported();
    return { block: false };
  }

  if (context.executedMiddleware) {
    logWarningAlreadyExecutedMiddleware();
  }

  updateContext(context, "executedMiddleware", true);
  agent.onMiddlewareExecuted();

  if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
    return { block: true, type: "blocked", trigger: "user" };
  }

  // WAF rule evaluation
  const wafResult = evaluateWafRules(context);
  if (wafResult.matched && wafResult.action === "block") {
    return {
      block: true,
      type: "waf",
      trigger: "waf",
      ip: context.remoteAddress,
    };
  }

  const rateLimitResult = shouldRateLimitRequest(context, agent);
  if (rateLimitResult.block) {
    // Mark the request as rate limited in the context
    updateContext(context, "rateLimitedEndpoint", rateLimitResult.endpoint);

    return {
      block: true,
      type: "ratelimited",
      trigger: rateLimitResult.trigger,
      ip: context.remoteAddress,
    };
  }

  return { block: false };
}

let loggedWarningShouldBlockRequestCalledWithoutContext = false;

function logWarningShouldBlockRequestCalledWithoutContext() {
  if (loggedWarningShouldBlockRequestCalledWithoutContext) {
    return;
  }

  console.warn(
    "Zen.shouldBlockRequest() was called without a context. The request will not be blocked. Make sure to call shouldBlockRequest() within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports)."
  );

  loggedWarningShouldBlockRequestCalledWithoutContext = true;
}

let loggedWarningAlreadyExecutedMiddleware = false;

function logWarningAlreadyExecutedMiddleware() {
  if (loggedWarningAlreadyExecutedMiddleware) {
    return;
  }

  console.warn(
    "Zen.shouldBlockRequest() was called multiple times. The middleware should be executed once per request."
  );

  loggedWarningAlreadyExecutedMiddleware = true;
}

let loggedWarningServerlessMiddleware = false;

function logWarningServerlessNotSupported() {
  if (loggedWarningServerlessMiddleware) {
    return;
  }

  console.warn(
    "Zen.shouldBlockRequest() was called within a serverless function. Rate limiting and user blocking are only supported for traditional/long running apps due to the constraints of serverless environments."
  );

  loggedWarningServerlessMiddleware = true;
}
