/* eslint-disable max-lines-per-function */
import { lookup } from "dns";
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import { getPortFromURL } from "../helpers/getPortFromURL";
import { tryParseURL } from "../helpers/tryParseURL";
import { checkContextForSSRF } from "../vulnerabilities/ssrf/checkContextForSSRF";
import { Hostname } from "../vulnerabilities/ssrf/Hostname";
import { inspectDNSLookupCalls } from "../vulnerabilities/ssrf/inspectDNSLookupCalls";
import { wrapDispatch } from "./undici/wrapDispatch";

export class Fetch implements Wrapper {
  private patchedGlobalDispatcher = false;

  private inspectHostname(
    agent: Agent,
    hostname: URL,
    port: number | undefined
  ): InterceptorResult {
    // Let the agent know that we are connecting to this hostname
    // This is to build a list of all hostnames that the application is connecting to
    if (typeof port === "number" && port > 0) {
      agent.onConnectHostname(hostname.hostname, port);
    }
    const context = getContext();

    if (!context) {
      return undefined;
    }

    return checkContextForSSRF({
      hostname: Hostname.fromURL(hostname),
      operation: "fetch",
      context: context,
      port: port,
    });
  }

  inspectFetch(args: unknown[], agent: Agent): InterceptorResult {
    if (args.length > 0) {
      // URL string
      if (typeof args[0] === "string" && args[0].length > 0) {
        const url = tryParseURL(args[0]);
        if (url) {
          const attack = this.inspectHostname(agent, url, getPortFromURL(url));
          if (attack) {
            return attack;
          }
        }
      }

      // Fetch accepts any object with a stringifier. User input may be an array if the user provides an array
      // query parameter (e.g., ?example[0]=https://example.com/) in frameworks like Express. Since an Array has
      // a default stringifier, this is exploitable in a default setup.
      // The following condition ensures that we see the same value as what's passed down to the sink.
      if (Array.isArray(args[0])) {
        const url = tryParseURL(args[0].toString());
        if (url) {
          const attack = this.inspectHostname(agent, url, getPortFromURL(url));
          if (attack) {
            return attack;
          }
        }
      }

      // URL object
      if (args[0] instanceof URL && args[0].hostname.length > 0) {
        const attack = this.inspectHostname(
          agent,
          args[0],
          getPortFromURL(args[0])
        );
        if (attack) {
          return attack;
        }
      }

      // Request object
      if (args[0] instanceof Request) {
        const url = tryParseURL(args[0].url);
        if (url) {
          const attack = this.inspectHostname(agent, url, getPortFromURL(url));
          if (attack) {
            return attack;
          }
        }
      }
    }

    return undefined;
  }

  // We'll set a global dispatcher that will allow us to inspect the resolved IPs (and thus preventing TOCTOU attacks)
  private patchGlobalDispatcher(agent: Agent) {
    const undiciGlobalDispatcherSymbol = Symbol.for(
      "undici.globalDispatcher.1"
    );

    // @ts-expect-error Type is not defined
    const dispatcher = globalThis[undiciGlobalDispatcherSymbol];

    if (!dispatcher) {
      agent.log(
        `global dispatcher not found for fetch, we can't provide protection!`
      );
      return;
    }

    if (dispatcher.constructor.name !== "Agent") {
      agent.log(
        `Expected Agent as global dispatcher for fetch but found ${dispatcher.constructor.name}, we can't provide protection!`
      );
      return;
    }

    try {
      // @ts-expect-error Type is not defined
      globalThis[undiciGlobalDispatcherSymbol] = new dispatcher.constructor({
        connect: {
          lookup: inspectDNSLookupCalls(lookup, agent, "fetch", "fetch"),
        },
      });

      // @ts-expect-error Type is not defined
      globalThis[undiciGlobalDispatcherSymbol].dispatch = wrapDispatch(
        // @ts-expect-error Type is not defined
        globalThis[undiciGlobalDispatcherSymbol].dispatch,
        agent
      );
    } catch (error) {
      agent.log(
        `Failed to patch global dispatcher for fetch, we can't provide protection!`
      );
    }
  }

  wrap(hooks: Hooks) {
    if (typeof globalThis.fetch === "function") {
      // Fetch is lazy loaded in Node.js
      // By calling fetch() we ensure that the global dispatcher is available
      try {
        // @ts-expect-error Type is not defined
        globalThis.fetch().catch(() => {});
      } catch (error) {
        // Ignore errors
      }
    }

    hooks.addGlobal("fetch", {
      // Whenever a request is made, we'll check the hostname whether it's a private IP
      inspectArgs: (args, agent) => this.inspectFetch(args, agent),
      modifyArgs: (args, agent) => {
        if (!this.patchedGlobalDispatcher) {
          this.patchGlobalDispatcher(agent);
          this.patchedGlobalDispatcher = true;
        }

        return args;
      },
    });
  }
}
