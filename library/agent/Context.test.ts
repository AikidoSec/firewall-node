import * as t from "tap";
import { extractStringsFromUserInputCached } from "../helpers/extractStringsFromUserInputCached";
import {
  type Context,
  getContext,
  runWithContext,
  bindContext,
  updateContext,
} from "./Context";
import { AsyncLocalStorage } from "node:async_hooks";

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

t.test(
  "Context is mixed if promise is created in first execution context",
  async (t) => {
    const context1 = { ...sampleContext, url: "http://localhost:4000/one" };
    const context2 = { ...sampleContext, url: "http://localhost:4000/two" };

    let promise: Promise<void>;

    runWithContext(context1, () => {
      promise = new Promise((resolve) => {
        setTimeout(() => {
          t.equal(getContext()!.url, "http://localhost:4000/one");
          resolve();
        }, 50);
      });
    });

    await runWithContext(context2, async () => {
      t.equal(getContext()!.url, "http://localhost:4000/two");
      await promise!;
    });

    t.equal(getContext(), undefined);
  }
);

t.test(
  "Context is mixed if promise is created in first execution context, even with bindContext",
  async (t) => {
    const context1 = { ...sampleContext, url: "http://localhost:4000/one" };
    const context2 = { ...sampleContext, url: "http://localhost:4000/two" };

    let promise: Promise<void>;

    runWithContext(context1, () => {
      promise = new Promise((resolve) => {
        t.equal(getContext()!.url, "http://localhost:4000/one");
        resolve();
      });
    });

    await runWithContext(context2, async () => {
      t.equal(getContext()!.url, "http://localhost:4000/two");
      await promise!;
    });

    t.equal(getContext(), undefined);
  }
);

t.test(
  "Context is not mixed if promise function is created in first execution context",
  async (t) => {
    const context1 = { ...sampleContext, url: "http://localhost:4000/one" };
    const context2 = { ...sampleContext, url: "http://localhost:4000/two" };

    let query: () => Promise<void>;
    let promiseCalls = 0;
    let expectedUrl: string | undefined;

    await runWithContext(context1, async () => {
      query = () =>
        new Promise((resolve) => {
          setTimeout(() => {
            t.equal(getContext()?.url, expectedUrl);
            promiseCalls++;

            resolve();
          }, 50);
        });
      expectedUrl = "http://localhost:4000/one";
      await query();
    });

    await runWithContext(context2, async () => {
      t.equal(getContext()!.url, "http://localhost:4000/two");
      expectedUrl = "http://localhost:4000/two";
      await query();
    });

    t.equal(getContext(), undefined);
    expectedUrl = undefined;
    await query!();

    t.equal(promiseCalls, 3);
  }
);

t.test(
  "It always uses the correct async context inside event handlers",
  async (t) => {
    const { EventEmitter } = require("events");
    const emitter = new EventEmitter();

    const context1 = { ...sampleContext, url: "http://localhost:4000/one" };
    const context2 = { ...sampleContext, url: "http://localhost:4000/two" };

    let eventFunc = () => {
      t.same(getContext()?.url, "http://localhost:4000/two");
    };

    emitter.on("event", eventFunc);
    t.equal(getContext(), undefined);

    runWithContext(context2, () => {
      emitter.emit("event");
    });
    emitter.off("event", eventFunc);

    runWithContext(context1, () => {
      eventFunc = async () => {
        t.same(getContext()?.url, "http://localhost:4000/two");
      };
    });

    emitter.on("event", eventFunc);

    runWithContext(context2, () => {
      emitter.emit("event");
    });

    emitter.off("event", eventFunc);

    eventFunc = () => {
      t.same(getContext()?.url, "http://localhost:4000/one");
    };

    emitter.on("event", eventFunc);

    runWithContext(context1, () => {
      emitter.emit("event");
    });
  }
);

t.test("Parallel execution contexts do not interfere", async (t) => {
  const als = new AsyncLocalStorage<{ id: number }>();
  const getCtx = () => als.getStore();

  const simulateQuery = async (expectedContext: {
    id: number;
  }): Promise<void> => {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        t.same(getCtx(), expectedContext);
        resolve();
      }, Math.random() * 10);
    });
  };

  const tasks: Promise<void>[] = [];
  for (let i = 0; i < 1000; i++) {
    const context = { id: i };
    const task = als.run(context, async () => {
      await simulateQuery(context);
    });
    tasks.push(task);
  }

  await Promise.all(tasks);
});

t.test("Init class and use in different contexts", async (t) => {
  class TestClass {
    getContextUrl() {
      const context = getContext();
      return context ? context.url : null;
    }
  }

  const context1 = { ...sampleContext, url: "http://localhost:4000/one" };
  const context2 = { ...sampleContext, url: "http://localhost:4000/two" };

  const instance1 = new TestClass();
  let instance2: TestClass;
  let instance3: TestClass;

  runWithContext(context1, () => {
    t.equal(instance1.getContextUrl(), "http://localhost:4000/one");

    instance2 = new TestClass();
    t.equal(instance2.getContextUrl(), "http://localhost:4000/one");

    instance3 = new TestClass();
    instance3.getContextUrl = bindContext(instance3.getContextUrl);
    t.equal(instance3.getContextUrl(), "http://localhost:4000/one");
  });

  runWithContext(context2, () => {
    t.equal(instance1.getContextUrl(), "http://localhost:4000/two");
    t.equal(instance2.getContextUrl(), "http://localhost:4000/two");
    t.equal(instance3.getContextUrl(), "http://localhost:4000/one");
  });

  t.equal(instance1.getContextUrl(), null);
  t.equal(instance2!.getContextUrl(), null);
  t.equal(instance3!.getContextUrl(), "http://localhost:4000/one");
});

t.test(
  "Context is lost if callback is called after runWithContext finishes",
  async (t) => {
    let callback: (() => void) | undefined;
    runWithContext(sampleContext, () => {
      callback = () => {
        t.equal(getContext(), undefined);
      };
    });
    callback!();
  }
);

t.test(
  "Context is not shared between parallel runWithContext calls",
  async (t) => {
    const contextA = { ...sampleContext, url: "A" };
    const contextB = { ...sampleContext, url: "B" };

    let resultA: string | undefined;
    let resultB: string | undefined;

    await Promise.all([
      new Promise<void>((resolve) => {
        runWithContext(contextA, () => {
          setTimeout(() => {
            resultA = getContext()?.url;
            resolve();
          }, 10);
        });
      }),
      new Promise<void>((resolve) => {
        runWithContext(contextB, () => {
          setTimeout(() => {
            resultB = getContext()?.url;
            resolve();
          }, 10);
        });
      }),
    ]);

    t.equal(resultA, "A", "Context A should be isolated");
    t.equal(resultB, "B", "Context B should be isolated");
  }
);

t.test("Context is preserved in Promise.then chains", async (t) => {
  await runWithContext(sampleContext, async () => {
    await Promise.resolve()
      .then(() => {
        t.match(
          getContext(),
          sampleContext,
          "Context should be preserved in then"
        );
        return Promise.resolve();
      })
      .then(() => {
        t.match(
          getContext(),
          sampleContext,
          "Context should be preserved in chained then"
        );
      });
  });
});

t.test("Context is not lost in process.nextTick callbacks", async (t) => {
  let callCount = 0;
  runWithContext(sampleContext, () => {
    process.nextTick(() => {
      t.equal(getContext()?.url, sampleContext.url);
      callCount++;
    });
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  t.equal(callCount, 1);
});
