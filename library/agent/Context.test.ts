import * as t from "tap";
import { extractStringsFromUserInputCached } from "../helpers/extractStringsFromUserInputCached";
import {
  type Context,
  getContext,
  runWithContext,
  bindContext,
  updateContext,
} from "./Context";

const sampleContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {
    abc: "def",
  },
  headers: {},
  body: undefined,
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("context is passed to the function", async (t) => {
  runWithContext(sampleContext, () => {
    t.match(getContext(), sampleContext);
  });
});

t.test("context is not shared outside of runWithContext", async (t) => {
  runWithContext(sampleContext, () => {
    t.match(getContext(), sampleContext);
  });

  t.equal(getContext(), undefined);
});

t.test("context is modified properly when already set", async (t) => {
  runWithContext({ ...sampleContext, method: "GET" }, () => {
    const context = getContext();
    if (!context) {
      t.fail();
      return;
    }
    runWithContext(context, () => {
      t.match(getContext(), { ...sampleContext, method: "GET" });
    });
  });
});

t.test("context is available in callback functions", (t) => {
  runWithContext(sampleContext, () => {
    setTimeout(() => {
      t.match(getContext(), sampleContext);
      t.end();
    }, 10);
  });
});

t.test("Get context does work inside a event handler", async (t) => {
  const { EventEmitter } = require("events");
  const emitter = new EventEmitter();

  await runWithContext(sampleContext, async () => {
    emitter.on("event", () => {
      t.same(getContext(), sampleContext);
    });
    emitter.emit("event");
  });
});

t.test(
  "Get context does not work inside a event handler if event is emitted outside of runWithContext",
  async (t) => {
    const { EventEmitter } = require("events");
    const emitter = new EventEmitter();

    await runWithContext(sampleContext, async () => {
      emitter.on("event", () => {
        t.same(getContext(), undefined);
      });
    });

    emitter.emit("event");
  }
);

t.test("Get context does work with bindContext", async (t) => {
  const { EventEmitter } = require("events");
  const emitter = new EventEmitter();

  await runWithContext(sampleContext, async () => {
    emitter.on(
      "event",
      bindContext(() => {
        t.same(getContext(), sampleContext);
      })
    );
  });

  emitter.emit("event");
});

t.test("it clears cache when context is mutated", async (t) => {
  const context = { ...sampleContext };

  runWithContext(context, () => {
    t.same(
      extractStringsFromUserInputCached(getContext()!),
      new Set(["abc", "def", "http://localhost:4000"])
    );

    updateContext(getContext()!, "query", {});
    t.same(
      extractStringsFromUserInputCached(getContext()!),
      new Set(["http://localhost:4000"])
    );

    runWithContext({ ...context, body: { a: "z" }, query: { b: "y" } }, () => {
      t.same(
        extractStringsFromUserInputCached(getContext()!),
        new Set(["a", "z", "b", "y", "http://localhost:4000"])
      );
    });
  });
});
