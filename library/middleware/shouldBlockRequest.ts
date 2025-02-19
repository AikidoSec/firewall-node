import { getInstance } from "../agent/AgentSingleton";
import { getContext, updateContext } from "../agent/Context";
import { shouldRateLimitRequest } from "../ratelimiting/shouldRateLimitRequest";

type Result = {
  block: boolean;
  type?: "ratelimited" | "blocked";
  trigger?: "ip" | "user";
  ip?: string;
};

const SERVERLESS_URL = "http://localhost:5132";

export async function shouldBlockRequestAsync(): Promise<Result> {
  const context = getContext();
  if (!context) {
    return { block: false };
  }

  const agent = getInstance();
  if (!agent) {
    return { block: false };
  }

  const response = await fetch(`${SERVERLESS_URL}/check-request`, {
    method: "POST",
    headers: {
      // TODO: Remove "!", token is not guaranteed to be present
      Authorization: agent.getToken()!.asString(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method: context.method,
      headers: context.headers,
      url: context.url,
      route: context.route,
      clientIp: context.remoteAddress,
    }),
  });

  return await response.json();
}

export function shouldBlockRequest(): Result {
  const context = getContext();
  if (!context) {
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
