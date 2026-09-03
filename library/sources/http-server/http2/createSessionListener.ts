import { Agent } from "../../../agent/Agent";
import { ServerHttp2Session } from "http2";
import { createStreamListener } from "./createStreamListener";

/**
 * Wraps the http2 session listener to be able to instrument stream events.
 */
export function createSessionListener(listener: Function, agent: Agent) {
  return function sessionListener(session: ServerHttp2Session) {
    // Wrap all session events to instrument stream events
    session.on = wrapStreamEvent(session.on, agent);
    session.once = wrapStreamEvent(session.once, agent);
    session.addListener = wrapStreamEvent(session.addListener, agent);
    session.prependListener = wrapStreamEvent(session.prependListener, agent);
    session.prependOnceListener = wrapStreamEvent(
      session.prependOnceListener,
      agent
    );

    return listener(session);
  };
}

function wrapStreamEvent(orig: Function, agent: Agent) {
  return function wrap(...args: unknown[]) {
    if (
      args.length !== 2 ||
      args[0] !== "stream" ||
      typeof args[1] !== "function"
    ) {
      return orig.apply(
        // @ts-expect-error We don't know the type of `this`
        this,
        arguments
      );
    }

    return orig.apply(
      // @ts-expect-error We don't know the type of `this`
      this,
      [args[0], createStreamListener(args[1], "http2", agent)]
    );
  };
}
