import { Agent } from "../../agent/Agent";
import { getContext } from "../../agent/Context";

export function wrapSocketEventHandler(handler: any, agent: Agent): any {
  return function wrappedEvent(event: string, listener: unknown) {
    console.log("Wrapped event", event);

    // Todo limit wrapping to specific events
    if (typeof listener === "function") {
      listener = wrapSocketEventListener(event, listener, agent);
    }

    return handler.apply(
      // @ts-expect-error We don't now the type of this
      this,
      [event, listener]
    );
  };
}

export function wrapSocketEventListener(
  event: string,
  listener: any,
  agent: Agent
): any {
  return function wrappedListener() {
    const context = getContext();
    const returnListener = () => {
      return listener.apply(
        // @ts-expect-error We don't now the type of this
        this,
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
    };

    console.log(`New ws event emitted: ${event}`);
    console.log(arguments);

    if (!context) {
      console.log("!No context found!");
      // We expect the context to be set by the connection handler
      return returnListener();
    }

    // Todo ...

    return returnListener();
  };
}
