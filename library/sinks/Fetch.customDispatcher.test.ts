import * as t from "tap";
import * as http from "http";
import { Agent as UndiciAgent } from "undici-v8";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { Context, runWithContext } from "../agent/Context";
import { wrap } from "../helpers/wrap";
import { Fetch } from "./Fetch";
import * as dns from "dns";
import { createTestAgent } from "../helpers/createTestAgent";
import { LoggerForTesting } from "../agent/logger/LoggerForTesting";
import { getInternalDispatcherOptions } from "./undici/getInternalDispatcherOptions";

wrap(dns, "lookup", function lookup(original) {
  return function lookup() {
    const hostname = arguments[0];

    if (hostname === "thisdomainpointstointernalip.com") {
      return original.apply(
        // @ts-expect-error We don't know the type of `this`
        this,
        ["127.0.0.1", ...Array.from(arguments).slice(1)]
      );
    }

    original.apply(
      // @ts-expect-error We don't know the type of `this`
      this,
      arguments
    );
  };
});

function createContext(port: number): Context {
  return {
    remoteAddress: "1.2.3.4",
    method: "POST",
    url: "http://public-app.example.com",
    query: {},
    headers: {},
    body: {
      image: `http://thisdomainpointstointernalip.com:${port}/path`,
    },
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/posts/:id",
  };
}

t.test(
  "fetch() with a custom dispatcher is still protected against SSRF",
  { skip: !global.fetch ? "fetch is not available" : false },
  async (t) => {
    const secret = "TOP-SECRET-INTERNAL-DATA";
    const server = http.createServer((req, res) => {
      res.end(secret);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to start test server");
    }
    const port = address.port;
    const targetUrl = `http://thisdomainpointstointernalip.com:${port}/`;

    t.teardown(() => server.close());

    const api = new ReportingAPIForTesting();
    const agent = createTestAgent({
      token: new Token("123"),
      api,
    });

    agent.start([new Fetch()]);

    await runWithContext(createContext(port), async () => {
      const error = await t.rejects(() => fetch(targetUrl));
      if (error instanceof Error) {
        t.same(
          // @ts-expect-error Type is not defined
          error.cause.message,
          "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
        );
      }
    });

    await runWithContext(createContext(port), async () => {
      const customDispatcher = new UndiciAgent();

      let reachedServer = false;
      const error = await t.rejects(() =>
        fetch(targetUrl, {
          // @ts-expect-error Type does not exist
          dispatcher: customDispatcher,
        }).then(async (res) => {
          reachedServer = (await res.text()) === secret;
        })
      );

      t.notOk(reachedServer);

      if (error instanceof Error) {
        t.same(
          // @ts-expect-error Type is not defined
          error.cause.message,
          "Zen has blocked a server-side request forgery: fetch(...) originating from body.image"
        );
      }

      let reachedServerAgain = false;
      const error2 = await t.rejects(() =>
        fetch(targetUrl, {
          // @ts-expect-error Type does not exist
          dispatcher: customDispatcher,
        }).then(async (res) => {
          reachedServerAgain = (await res.text()) === secret;
        })
      );
      t.notOk(reachedServerAgain);
      t.ok(error2 instanceof Error);
    });

    await runWithContext(createContext(port), async () => {
      const customDispatcher = new UndiciAgent();

      const res = await fetch("https://app.aikido.dev", {
        // @ts-expect-error Type does not exist
        dispatcher: customDispatcher,
      });
      t.ok(res.ok || res.status > 0);
    });
  }
);

function setupPatchTest() {
  const logger = new LoggerForTesting();
  const agent = createTestAgent({ token: new Token("123"), logger });
  const fetchSink = new Fetch();

  return {
    logger,
    patch: (dispatcher: unknown) => {
      // Reach into the private method directly to unit-test the branchy
      // reflection logic in isolation from real network calls
      (
        fetchSink as unknown as {
          patchCustomDispatcher: (d: unknown, a: typeof agent) => void;
        }
      ).patchCustomDispatcher(dispatcher, agent);
    },
  };
}

t.test("ignores non-object dispatchers", async (t) => {
  const { patch, logger } = setupPatchTest();

  t.doesNotThrow(() => patch(null));
  t.doesNotThrow(() => patch(undefined));
  t.doesNotThrow(() => patch("string"));
  t.doesNotThrow(() => patch(42));
  t.doesNotThrow(() => patch(true));
  t.doesNotThrow(() => patch([]));

  t.same(logger.getMessages(), []);
});

t.test("ignores dispatchers without a dispatch function", async (t) => {
  const { patch, logger } = setupPatchTest();

  const fakeDispatcher = { dispatch: "not-a-function" };
  patch(fakeDispatcher);

  t.same(fakeDispatcher.dispatch, "not-a-function");
  t.same(logger.getMessages(), []);
});

t.test(
  "wraps dispatch and injects a lookup when there is no connect option",
  async (t) => {
    const { patch, logger } = setupPatchTest();
    const dispatcher = new UndiciAgent();
    const originalDispatch = dispatcher.dispatch;

    patch(dispatcher);

    t.not(dispatcher.dispatch, originalDispatch);

    const options = getInternalDispatcherOptions(dispatcher);
    t.ok(options, "found internal options");
    t.equal(
      typeof (options as { connect?: { lookup?: unknown } }).connect?.lookup,
      "function"
    );
    t.same(logger.getMessages(), []);
  }
);

t.test(
  "wraps an existing custom connect.lookup instead of discarding it",
  async (t) => {
    const { patch } = setupPatchTest();

    let customLookupCalled = false;
    const customLookup = (
      hostname: string,
      optionsOrCb: unknown,
      maybeCb?: unknown
    ) => {
      customLookupCalled = true;
      const cb = (
        typeof optionsOrCb === "function" ? optionsOrCb : maybeCb
      ) as (err: Error | null, address: string, family: number) => void;
      cb(null, "127.0.0.1", 4);
    };

    const dispatcher = new UndiciAgent({
      connect: { lookup: customLookup as never },
    });

    patch(dispatcher);

    const options = getInternalDispatcherOptions(dispatcher) as {
      connect?: { lookup?: unknown };
    };
    const wrappedLookup = options.connect?.lookup;

    t.equal(typeof wrappedLookup, "function");
    t.not(wrappedLookup, customLookup);

    await new Promise<void>((resolve) => {
      (
        wrappedLookup as (
          hostname: string,
          cb: (err: Error | null, address: string) => void
        ) => void
      )("example.com", (err) => {
        t.notOk(err);
        resolve();
      });
    });

    t.ok(customLookupCalled);
  }
);

t.test(
  "logs and leaves a function-based connect option untouched",
  async (t) => {
    const { patch, logger } = setupPatchTest();

    const customConnect = () => {};
    const dispatcher = new UndiciAgent({ connect: customConnect as never });
    const originalDispatch = dispatcher.dispatch;

    patch(dispatcher);

    const options = getInternalDispatcherOptions(dispatcher) as {
      connect?: unknown;
    };
    t.equal(options.connect, customConnect);

    t.ok(
      logger
        .getMessages()
        .some((m) => m.includes("function-based connect option")),
      "logged a reduced-protection warning"
    );

    t.not(dispatcher.dispatch, originalDispatch);
  }
);

t.test("logs when the internal options symbol can't be found", async (t) => {
  const { patch, logger } = setupPatchTest();

  const fakeDispatcher = { dispatch: () => {} };
  const originalDispatch = fakeDispatcher.dispatch;

  patch(fakeDispatcher);

  t.ok(
    logger
      .getMessages()
      .some((m) => m.includes("Could not find internal options"))
  );
  t.not(fakeDispatcher.dispatch, originalDispatch);
});

t.test("does not re-patch an already-patched dispatcher", async (t) => {
  const { patch } = setupPatchTest();
  const dispatcher = new UndiciAgent();

  patch(dispatcher);
  const dispatchAfterFirstPatch = dispatcher.dispatch;
  const lookupAfterFirstPatch = (
    getInternalDispatcherOptions(dispatcher) as {
      connect?: { lookup?: unknown };
    }
  ).connect?.lookup;

  patch(dispatcher);

  t.equal(dispatcher.dispatch, dispatchAfterFirstPatch);
  t.equal(
    (
      getInternalDispatcherOptions(dispatcher) as {
        connect?: { lookup?: unknown };
      }
    ).connect?.lookup,
    lookupAfterFirstPatch
  );
});

t.test("gracefully logs when patching throws", async (t) => {
  const { patch, logger } = setupPatchTest();
  const dispatcher = new UndiciAgent();

  const options = getInternalDispatcherOptions(dispatcher);
  t.ok(options);
  Object.freeze(options);

  t.doesNotThrow(() => patch(dispatcher));

  t.ok(
    logger
      .getMessages()
      .some((m) => m.includes("Failed to patch custom dispatcher"))
  );
});
