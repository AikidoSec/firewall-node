import { getInstance } from "../AgentSingleton";
import { ContextStorage } from "./ContextStorage";

export function track(eventName: string): void {
  const agent = getInstance();

  if (!agent) {
    return;
  }

  if (typeof eventName !== "string" || eventName.length === 0) {
    agent.log(`track(...) expects a non-empty string as event name.`);
    return;
  }

  const context = ContextStorage.getStore();
  if (!context) {
    logWarningTrackCalledWithoutContext();
    return;
  }

  agent.onTrackEvent({
    type: "custom",
    name: eventName,
    request: {
      url: context.url,
      method: context.method,
      ipAddress: context.remoteAddress,
      userAgent:
        typeof context.headers["user-agent"] === "string"
          ? context.headers["user-agent"]
          : undefined,
      source: context.source,
      route: context.route,
    },
    user: context.user,
    time: Date.now(),
  });
}

let loggedWarningTrackCalledWithoutContext = false;

function logWarningTrackCalledWithoutContext() {
  if (loggedWarningTrackCalledWithoutContext) {
    return;
  }

  // oxlint-disable-next-line no-console
  console.warn(
    "track(...) was called without a context. The event will not be tracked. Make sure to call track(...) within an HTTP request."
  );

  loggedWarningTrackCalledWithoutContext = true;
}
