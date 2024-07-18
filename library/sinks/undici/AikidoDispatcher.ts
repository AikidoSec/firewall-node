import type { Dispatcher, Agent } from "undici";
import { tryParseURL } from "../../helpers/tryParseURL";
import { getContext } from "../../agent/Context";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { RequestContextStorage } from "./RequestContextStorage";

export function getDispatcher(origDispatcher: Dispatcher) {
  // @ts-expect-error ???
  return class AikidoDispatcher extends origDispatcher.constructor {
    constructor(options = {}) {
      super(options);
    }

    dispatch(
      opts: Agent.DispatchOptions,
      handler: Dispatcher.DispatchHandlers
    ) {
      const context = getContext();
      if (!context) {
        return origDispatcher.dispatch(opts, handler);
      }

      if (!opts || !opts.origin) {
        return origDispatcher.dispatch(opts, handler);
      }

      let url: URL | undefined;
      if (typeof opts.origin === "string") {
        url = tryParseURL(opts.origin);
      } else if (opts.origin instanceof URL) {
        url = opts.origin;
      }

      if (!url) {
        return origDispatcher.dispatch(opts, handler);
      }

      const port = getPortFromURL(url);
      if (!port) {
        return origDispatcher.dispatch(opts, handler);
      }
      // We'll set the outgoing request port to a additonal context
      // Its needed to prevent false positives when the hostname is the same but the port is different
      // Because on inspectDNSLookupCalls we only have the hostname
      return RequestContextStorage.run({ port }, () => {
        return origDispatcher.dispatch(opts, handler);
      });
    }

    close() {
      return origDispatcher.close();
    }

    destroy() {
      return origDispatcher.destroy();
    }
  };
}
