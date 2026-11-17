import { getInstance } from "../AgentSingleton";
import { ContextStorage } from "./ContextStorage";

const MAX_CUSTOM_EVENTS_PER_REQUEST = 25;

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

  if (agent.getConfig().isBypassedRequest(context)) {
    return;
  }

  const customEventsTracked = context.customEventsTracked ?? 0;
  if (customEventsTracked >= MAX_CUSTOM_EVENTS_PER_REQUEST) {
    if (!context.customEventLimitWarningLogged) {
      logWarningCustomEventLimitReached();
      context.customEventLimitWarningLogged = true;
    }
    return;
  }
  context.customEventsTracked = customEventsTracked + 1;

  agent.onTrackEvent({
    type: "custom",
    name: eventName,
    request: {
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

function logWarningCustomEventLimitReached() {
  // oxlint-disable-next-line no-console
  console.warn(
    `Zen.track(...) was called more than ${MAX_CUSTOM_EVENTS_PER_REQUEST} times during one request. Only the first ${MAX_CUSTOM_EVENTS_PER_REQUEST} events were tracked.`
  );
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
