import * as t from "tap";
import { z } from "zod";
import { Context, getContext, runWithContext } from "../agent/Context";
import { setUser } from "../agent/context/user";
import { createTestAgent } from "../helpers/createTestAgent";
import { Trpc } from "./Trpc";

const agent = createTestAgent();
agent.start([new Trpc()]);

function getTestContext(): Context {
  return {
    remoteAddress: "::1",
    method: "POST",
    url: "http://localhost:4000/trpc/cats.byName",
    query: {},
    headers: {
      "content-type": "application/json",
    },
    body: undefined,
    cookies: {},
    routeParams: {},
    source: "http",
    route: "/trpc/cats.byName",
  };
}

async function buildRouter() {
  const { initTRPC } = require("@trpc/server") as typeof import("@trpc/server");
  const trpc = initTRPC.create();

  const router = trpc.router({
    byName: trpc.procedure
      .input(z.string())
      .query(({ input }) => `cat:${input}`),
    create: trpc.procedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }) => `created:${input.name}`),
    list: trpc.procedure.query(() => "list"),
  });

  const createCaller = trpc.createCallerFactory(router);

  return { trpc, router, caller: createCaller({}) };
}

t.test("it captures the parsed query input in the context", async (t) => {
  const { caller } = await buildRouter();

  await runWithContext(getTestContext(), async () => {
    const result = await caller.byName("Whiskers' OR '1'='1");
    t.equal(result, "cat:Whiskers' OR '1'='1");
    t.same(getContext()?.trpc, ["Whiskers' OR '1'='1"]);
  });
});

t.test("it captures the parsed mutation input in the context", async (t) => {
  const { caller } = await buildRouter();

  await runWithContext(getTestContext(), async () => {
    await caller.create({ name: "Tom" });
    t.same(getContext()?.trpc, [{ name: "Tom" }]);
  });
});

t.test(
  "it accumulates input across multiple calls in the same context",
  async (t) => {
    const { caller } = await buildRouter();

    await runWithContext(getTestContext(), async () => {
      await caller.byName("Tom");
      await caller.byName("Jerry");
      t.same(getContext()?.trpc, ["Tom", "Jerry"]);
    });
  }
);

t.test(
  "it keeps a call's input visible while another call is still in flight in the same batch (e.g. httpBatchLink)",
  async (t) => {
    const { initTRPC } =
      require("@trpc/server") as typeof import("@trpc/server");
    const trpc = initTRPC.create();

    let releaseA: () => void;
    const bIsCapturedGate = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const proc = trpc.procedure.input(z.string()).query(async ({ input }) => {
      if (input === "A") {
        await bIsCapturedGate;
      } else {
        releaseA();
      }

      return getContext()?.trpc;
    });

    const router = trpc.router({ byName: proc });
    const caller = trpc.createCallerFactory(router)({});

    await runWithContext(getTestContext(), async () => {
      const [resultA, resultB] = await Promise.all([
        caller.byName("A"),
        caller.byName("B"),
      ]);

      t.same(resultA, ["A", "B"]);
      t.same(resultB, ["A", "B"]);
    });
  }
);

t.test("it does not throw for procedures without input", async (t) => {
  const { caller } = await buildRouter();

  await runWithContext(getTestContext(), async () => {
    const result = await caller.list();
    t.equal(result, "list");
  });
});

t.test("it does not throw without a context", async (t) => {
  const { caller } = await buildRouter();

  const result = await caller.byName("Tom");
  t.equal(result, "cat:Tom");
});

t.test(
  "it captures FormData input",
  {
    skip: !globalThis.FormData, // skip if FormData is not available (e.g. Node 16)
  },
  async (t) => {
    const { initTRPC } =
      require("@trpc/server") as typeof import("@trpc/server");
    const trpc = initTRPC.create();

    const proc = trpc.procedure
      .input(z.instanceof(FormData))
      .mutation(({ input }) => input.get("name"));

    const router = trpc.router({ upload: proc });
    const caller = trpc.createCallerFactory(router)({});

    const formData = new FormData();
    formData.append("name", "Felix");

    await runWithContext(getTestContext(), async () => {
      const result = await caller.upload(formData);
      t.equal(result, "Felix");
      t.same(getContext()?.trpc, [{ name: "Felix" }]);
    });
  }
);

t.test("it also wraps builders created via initTRPC.context()", async (t) => {
  const { initTRPC } = require("@trpc/server") as typeof import("@trpc/server");
  const trpc = initTRPC.context<{ userId: string }>().create();

  const router = trpc.router({
    byName: trpc.procedure
      .input(z.string())
      .query(({ input }) => `cat:${input}`),
  });

  const caller = trpc.createCallerFactory(router)({ userId: "123" });

  await runWithContext(getTestContext(), async () => {
    await caller.byName("Garfield");
    t.same(getContext()?.trpc, ["Garfield"]);
  });
});

t.test("it also wraps builders created via initTRPC.meta()", async (t) => {
  const { initTRPC } = require("@trpc/server") as typeof import("@trpc/server");
  const trpc = initTRPC.meta<{ scope: string }>().create();

  const router = trpc.router({
    byName: trpc.procedure
      .input(z.string())
      .query(({ input }) => `cat:${input}`),
  });

  const caller = trpc.createCallerFactory(router)({});

  await runWithContext(getTestContext(), async () => {
    await caller.byName("Tom");
    t.same(getContext()?.trpc, ["Tom"]);
  });
});

t.test("it keeps capturing input after .use()", async (t) => {
  const { initTRPC } = require("@trpc/server") as typeof import("@trpc/server");
  const trpc = initTRPC.create();

  const proc = trpc.procedure
    .use(async (opts) => opts.next())
    .input(z.string())
    .query(({ input }) => `cat:${input}`);

  const router = trpc.router({ byName: proc });
  const caller = trpc.createCallerFactory(router)({});

  await runWithContext(getTestContext(), async () => {
    await caller.byName("Felix");
    t.same(getContext()?.trpc, ["Felix"]);
  });
});

t.test(
  "it passes ctx set by a middleware through to the resolver, while still capturing input",
  async (t) => {
    const { initTRPC } =
      require("@trpc/server") as typeof import("@trpc/server");
    const trpc = initTRPC.context<{ userId?: string }>().create();

    const isAuthed = trpc.middleware(async (opts) => {
      return opts.next({
        ctx: { userId: "user-123" },
      });
    });

    const proc = trpc.procedure
      .use(isAuthed)
      .input(z.string())
      .query(({ input, ctx }) => `cat:${input}:${ctx.userId}`);

    const router = trpc.router({ byName: proc });
    const caller = trpc.createCallerFactory(router)({});

    await runWithContext(getTestContext(), async () => {
      const result = await caller.byName("Felix");
      t.equal(result, "cat:Felix:user-123");
      t.same(getContext()?.trpc, ["Felix"]);
    });
  }
);

t.test(
  "it merges ctx from multiple chained middlewares, while still capturing input",
  async (t) => {
    const { initTRPC } =
      require("@trpc/server") as typeof import("@trpc/server");
    const trpc = initTRPC
      .context<{ requestId?: string; userId?: string }>()
      .create();

    const withRequestId = trpc.middleware(async (opts) => {
      return opts.next({ ctx: { requestId: "req-1" } });
    });

    const withUser = trpc.middleware(async (opts) => {
      return opts.next({ ctx: { userId: "user-123" } });
    });

    const proc = trpc.procedure
      .use(withRequestId)
      .use(withUser)
      .input(z.string())
      .query(({ input, ctx }) => `cat:${input}:${ctx.requestId}:${ctx.userId}`);

    const router = trpc.router({ byName: proc });
    const caller = trpc.createCallerFactory(router)({});

    await runWithContext(getTestContext(), async () => {
      const result = await caller.byName("Felix");
      t.equal(result, "cat:Felix:req-1:user-123");
      t.same(getContext()?.trpc, ["Felix"]);
    });
  }
);

t.test(
  "it lets a tRPC middleware set the Zen user from the tRPC ctx",
  async (t) => {
    const { initTRPC } =
      require("@trpc/server") as typeof import("@trpc/server");
    const trpc = initTRPC.context<{ userId?: string }>().create();

    const isAuthed = trpc.middleware(async (opts) => {
      if (opts.ctx.userId) {
        setUser({ id: opts.ctx.userId });
      }
      return opts.next();
    });

    const proc = trpc.procedure
      .use(isAuthed)
      .input(z.string())
      .query(({ input }) => `cat:${input}`);

    const router = trpc.router({ byName: proc });
    const caller = trpc.createCallerFactory(router)({ userId: "user-123" });

    await runWithContext(getTestContext(), async () => {
      await caller.byName("Felix");
      t.same(getContext()?.trpc, ["Felix"]);
      t.same(getContext()?.user, { id: "user-123" });
    });
  }
);

t.test("it keeps capturing input after .meta()", async (t) => {
  const { initTRPC } = require("@trpc/server") as typeof import("@trpc/server");
  const trpc = initTRPC.create();

  const proc = trpc.procedure
    .meta({ scope: "cats" })
    .input(z.string())
    .query(({ input }) => `cat:${input}`);

  const router = trpc.router({ byName: proc });
  const caller = trpc.createCallerFactory(router)({});

  await runWithContext(getTestContext(), async () => {
    await caller.byName("Felix");
    t.same(getContext()?.trpc, ["Felix"]);
  });
});

t.test("it keeps capturing input after .output()", async (t) => {
  const { initTRPC } = require("@trpc/server") as typeof import("@trpc/server");
  const trpc = initTRPC.create();

  const proc = trpc.procedure
    .input(z.string())
    .output(z.string())
    .query(({ input }) => `cat:${input}`);

  const router = trpc.router({ byName: proc });
  const caller = trpc.createCallerFactory(router)({});

  await runWithContext(getTestContext(), async () => {
    await caller.byName("Felix");
    t.same(getContext()?.trpc, ["Felix"]);
  });
});

t.test("it keeps capturing input after .concat()", async (t) => {
  const { initTRPC } = require("@trpc/server") as typeof import("@trpc/server");
  const trpc = initTRPC.create();

  const base = trpc.procedure.use(async (opts) => opts.next());
  const proc = trpc.procedure
    .concat(base)
    .input(z.string())
    .query(({ input }) => `cat:${input}`);

  const router = trpc.router({ byName: proc });
  const caller = trpc.createCallerFactory(router)({});

  await runWithContext(getTestContext(), async () => {
    await caller.byName("Felix");
    t.same(getContext()?.trpc, ["Felix"]);
  });
});

t.test(
  "it captures input on procedures nested inside sub-routers",
  async (t) => {
    const { initTRPC } =
      require("@trpc/server") as typeof import("@trpc/server");
    const trpc = initTRPC.create();

    const router = trpc.router({
      cats: trpc.router({
        byName: trpc.procedure
          .input(z.string())
          .query(({ input }) => `cat:${input}`),
      }),
    });

    const caller = trpc.createCallerFactory(router)({});

    await runWithContext(getTestContext(), async () => {
      await caller.cats.byName("Felix");
      t.same(getContext()?.trpc, ["Felix"]);
    });
  }
);

t.test(
  "it does not capture input when a middleware short-circuits before the resolver",
  async (t) => {
    const { initTRPC, TRPCError } =
      require("@trpc/server") as typeof import("@trpc/server");
    const trpc = initTRPC.create();

    const proc = trpc.procedure
      .use(async () => {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      })
      .input(z.string())
      .query(({ input }) => `cat:${input}`);

    const router = trpc.router({ byName: proc });
    const caller = trpc.createCallerFactory(router)({});

    await runWithContext(getTestContext(), async () => {
      await t.rejects(caller.byName("Felix"));
      t.same(getContext()?.trpc, undefined);
    });
  }
);

t.test("it still captures input when the resolver itself throws", async (t) => {
  const { initTRPC } = require("@trpc/server") as typeof import("@trpc/server");
  const trpc = initTRPC.create();

  const proc = trpc.procedure.input(z.string()).query(() => {
    throw new Error("boom");
  });

  const router = trpc.router({ byName: proc });
  const caller = trpc.createCallerFactory(router)({});

  await runWithContext(getTestContext(), async () => {
    await t.rejects(caller.byName("Felix"));
    t.same(getContext()?.trpc, ["Felix"]);
  });
});

t.test(
  "it captures input for procedures branched off a shared base builder",
  async (t) => {
    const { initTRPC } =
      require("@trpc/server") as typeof import("@trpc/server");
    const trpc = initTRPC.create();

    const base = trpc.procedure.use(async (opts) => opts.next());

    const router = trpc.router({
      byName: base.input(z.string()).query(({ input }) => `cat:${input}`),
      create: base
        .input(z.object({ name: z.string() }))
        .mutation(({ input }) => `created:${input.name}`),
    });

    const caller = trpc.createCallerFactory(router)({});

    await runWithContext(getTestContext(), async () => {
      await caller.byName("Felix");
      t.same(getContext()?.trpc, ["Felix"]);
    });

    await runWithContext(getTestContext(), async () => {
      await caller.create({ name: "Tom" });
      t.same(getContext()?.trpc, [{ name: "Tom" }]);
    });
  }
);

t.test("it captures input for subscriptions", async (t) => {
  const { initTRPC } = require("@trpc/server") as typeof import("@trpc/server");
  const trpc = initTRPC.create();

  const proc = trpc.procedure
    .input(z.string())
    .subscription(async function* watch({ input }) {
      yield input;
    });

  const router = trpc.router({ watch: proc });
  const caller = trpc.createCallerFactory(router)({});

  await runWithContext(getTestContext(), async () => {
    const iterable = await caller.watch("Felix");
    const values: unknown[] = [];
    for await (const value of iterable) {
      values.push(value);
    }
    t.same(values, ["Felix"]);
    t.same(getContext()?.trpc, ["Felix"]);
  });
});
