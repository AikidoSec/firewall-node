import { getInstance } from "../agent/AgentSingleton";
import { getContext, updateContext } from "../agent/Context";
import { shouldRateLimitRequest } from "../ratelimiting/shouldRateLimitRequest";

type Result = {
  block: boolean;
  type?: "ratelimited" | "blocked";
  trigger?: "ip" | "user";
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

  updateContext(context, "executedMiddleware", true);
  agent.onMiddlewareExecuted();

  if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
    return { block: true, type: "blocked", trigger: "user" };
  }

  const rateLimitResult = shouldRateLimitRequest(context, agent);
  if (rateLimitResult.block) {
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

  // eslint-disable-next-line no-console
  console.warn(
    "shouldBlockRequest() was called without a context. The request will not be blocked. Make sure to call shouldBlockRequest() within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen."
  );

  loggedWarningShouldBlockRequestCalledWithoutContext = true;
}
