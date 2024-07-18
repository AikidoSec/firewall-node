import { Dispatcher, Agent } from "undici";
import { tryParseURL } from "../../helpers/tryParseURL";
import { getContext } from "../../agent/Context";
import { getPortFromURL } from "../../helpers/getPortFromURL";
import { RequestContextStorage } from "./RequestContextStorage";

export class AikidoDispatcher extends Dispatcher {
  private agent: Agent = new Agent();

  constructor(options = {}) {
    super(options);
    this.agent = new Agent(options);
  }

  dispatch(opts: Agent.DispatchOptions, handler: Dispatcher.DispatchHandlers) {
    const context = getContext();
    if (!context) {
      return this.agent.dispatch(opts, handler);
    }

    if (!opts || !opts.origin) {
      return this.agent.dispatch(opts, handler);
    }

    let url: URL | undefined;
    if (typeof opts.origin === "string") {
      url = tryParseURL(opts.origin);
    } else if (opts.origin instanceof URL) {
      url = opts.origin;
    }

    if (!url) {
      return this.agent.dispatch(opts, handler);
    }

    const port = getPortFromURL(url);
    if (!port) {
      return this.agent.dispatch(opts, handler);
    }

    // We'll set the outgoing request port to a additonal context
    // Its needed to prevent false positives when the hostname is the same but the port is different
    // Because on inspectDNSLookupCalls we only have the hostname
    return RequestContextStorage.run({ port }, () => {
      return this.agent.dispatch(opts, handler);
    });
  }

  close() {
    return this.agent.close();
  }

  destroy() {
    return this.agent.destroy();
  }
}
