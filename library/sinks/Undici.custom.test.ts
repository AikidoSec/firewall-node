import * as dns from "dns";
import * as t from "tap";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { startTestAgent } from "../helpers/startTestAgent";
import { wrap } from "../helpers/wrap";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { Undici } from "./Undici";

function createContext(): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4003",
    query: {},
    headers: {},
    body: {
      image: "http://thisdomainpointstointernalip.com/path",
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };
}

wrap(dns, "lookup", function lookup(original) {
  return function lookup() {
    original.apply(
      // @ts-expect-error We don't know the type of `this`
      this,
      ["localhost", ...Array.from(arguments).slice(1)]
    );
  };
});

t.test(
  "it works",
  {
    skip:
      getMajorNodeVersion() <= 16 ? "ReadableStream is not available" : false,
  },
  async (t) => {
    startTestAgent({
      token: new Token("123"),
      wrappers: [new Undici()],
      rewrite: { undici: "undici-v6" },
    });

    const { request, Dispatcher, setGlobalDispatcher, getGlobalDispatcher } =
      require("undici-v6") as typeof import("undici-v6");

    // See https://www.npmjs.com/package/@n8n_io/license-sdk
    // They set a custom dispatcher to proxy certain requests
    const originalDispatcher = getGlobalDispatcher();

    const kOptions = Object.getOwnPropertySymbols(originalDispatcher).find(
      (symbol) => {
        return symbol.description === "options";
      }
    );

    if (!kOptions) {
      throw new Error("Could not find the options symbol on the dispatcher");
    }

    // @ts-expect-error kOptions is a symbol
    const originalOptions = originalDispatcher[kOptions];

    t.ok(
      "connect" in originalOptions &&
        originalOptions.connect &&
        "lookup" in originalOptions.connect
    );

    setGlobalDispatcher(
      new (class CustomDispatcher extends Dispatcher {
        // @ts-expect-error The types of options and handler are unknown
        dispatch(options, handler) {
          // Custom logic comes here

          // Fallback to the original dispatcher
          return originalDispatcher.dispatch(options, handler);
        }
      })()
    );

    await runWithContext(createContext(), async () => {
      const error = await t.rejects(() =>
        request("http://thisdomainpointstointernalip.com")
      );
      if (error instanceof Error) {
        t.same(
          error.message,
          "Zen has blocked a server-side request forgery: undici.[method](...) originating from body.image"
        );
      }
    });
  }
);
