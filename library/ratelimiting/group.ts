import { isPlainObject } from "../helpers/isPlainObject";
import { getInstance } from "../agent/AgentSingleton";
import { getContext, updateContext } from "../agent/Context";

export function setRateLimitGroup(g: { id: string | number }) {
  const agent = getInstance();

  if (!agent) {
    return;
  }

  const context = getContext();
  if (!context) {
    logWarningSetRateLimitGroupCalledWithoutContext();
    return;
  }

  const group = g as unknown;

  if (!isPlainObject(group)) {
    agent.log(
      `setRateLimitGroup(...) expects an object with 'id' property, found ${typeof group} instead.`
    );
    return;
  }

  if (!("id" in group)) {
    agent.log(`setRateLimitGroup(...) expects an object with 'id' property.`);
    return;
  }

  if (typeof group.id !== "string" && typeof group.id !== "number") {
    agent.log(
      `setRateLimitGroup(...) expects an object with 'id' property of type string or number, found ${typeof group.id} instead.`
    );
    return;
  }

  if (typeof group.id === "string" && group.id.length === 0) {
    agent.log(
      `setRateLimitGroup(...) expects an object with 'id' property non-empty string.`
    );
    return;
  }

  const groupId = group.id.toString();

  if (context.executedMiddleware) {
    logWarningSetRateLimitGroupCalledAfterMiddleware();
  }

  updateContext(context, "rateLimitGroup", groupId);
}

let loggedWarningSetRateLimitGroupCalledAfterMiddleware = false;

function logWarningSetRateLimitGroupCalledAfterMiddleware() {
  if (loggedWarningSetRateLimitGroupCalledAfterMiddleware) {
    return;
  }

  // oxlint-disable-next-line no-console
  console.warn(
    `setRateLimitGroup(...) must be called before the Zen middleware is executed.`
  );

  loggedWarningSetRateLimitGroupCalledAfterMiddleware = true;
}

let loggedWarningSetRateLimitGroupCalledWithoutContext = false;

function logWarningSetRateLimitGroupCalledWithoutContext() {
  if (loggedWarningSetRateLimitGroupCalledWithoutContext) {
    return;
  }

  // oxlint-disable-next-line no-console
  console.warn(
    "setRateLimitGroup(...) was called without a context. Make sure to call setRateLimitGroup(...) within an HTTP request. If you're using serverless functions, make sure to use the handler wrapper provided by Zen. Also ensure you import Zen at the top of your main app file (before any other imports)."
  );

  loggedWarningSetRateLimitGroupCalledWithoutContext = true;
}
