/* oxlint-disable no-console */
import t from "tap";
import { EventEmitter } from "events";
import { setTimeout as sleep } from "node:timers/promises";
import {
  runWithTenant,
  getTenantContext,
  getTenantId,
  setTenantId,
} from "./tenantId";
import { runWithContext, bindContext, type Context } from "../Context";
import { createTestAgent } from "../../helpers/createTestAgent";

const requestContext: Context = {
  remoteAddress: "::1",
  method: "GET",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {},
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/orders",
};

t.test("getTenantContext is undefined without a tenant", async () => {
  t.equal(getTenantContext(), undefined);
});

t.test("getTenantId is undefined without a tenant", async () => {
  t.equal(getTenantId(), undefined);
});

t.test("getTenantId returns the tenant set by runWithTenant", async () => {
  runWithTenant("org_get", () => {
    t.equal(getTenantId(), "org_get");
  });

  t.equal(getTenantId(), undefined, "tenant does not leak after the callback");
});

t.test("getTenantId returns the tenant set by setTenantId", async () => {
  createTestAgent();

  runWithContext({ ...requestContext }, () => {
    setTenantId("org_get_req");
    t.equal(getTenantId(), "org_get_req");
  });

  t.equal(getTenantId(), undefined, "tenant does not leak outside the request");
});

t.test(
  "getTenantId prefers runWithTenant over the request context",
  async () => {
    createTestAgent();

    runWithContext({ ...requestContext }, () => {
      setTenantId("foreign");

      runWithTenant("correct", () => {
        t.equal(getTenantId(), "correct");
      });

      t.equal(
        getTenantId(),
        "foreign",
        "request tenant restored after callback"
      );
    });
  }
);

t.test("runWithTenant sets the tenant inside the callback", async () => {
  const result = runWithTenant("org_1", () => {
    t.same(getTenantContext(), { tenantId: "org_1" });
    return 42;
  });

  t.equal(result, 42);
  t.equal(
    getTenantContext(),
    undefined,
    "tenant does not leak after the callback"
  );
});

t.test("runWithTenant stringifies number tenant IDs", async () => {
  let ran = false;
  runWithTenant(10331, () => {
    ran = true;
    t.same(getTenantContext(), { tenantId: "10331" });
  });
  t.ok(ran);
});

t.test("runWithTenant survives async boundaries", async () => {
  let ran = false;
  await runWithTenant("org_async", async () => {
    await sleep(1);
    t.same(getTenantContext(), { tenantId: "org_async" });
    await sleep(1);
    t.same(getTenantContext(), { tenantId: "org_async" });
    ran = true;
  });
  t.ok(ran);
});

t.test("runWithTenant nests, inner overrides outer", async () => {
  let innerRan = false;
  await runWithTenant("outer", async () => {
    t.same(getTenantContext(), { tenantId: "outer" });

    await runWithTenant("inner", async () => {
      await sleep(1);
      t.same(getTenantContext(), { tenantId: "inner" });
      innerRan = true;
    });

    t.same(
      getTenantContext(),
      { tenantId: "outer" },
      "outer tenant restored after inner returns"
    );
  });
  t.ok(innerRan);
});

t.test(
  "tenant is available in event-emitter callbacks bound with bindContext",
  async () => {
    const emitter = new EventEmitter();
    let called = false;

    await runWithTenant("org_emit", async () => {
      emitter.on(
        "event",
        bindContext(() => {
          called = true;
          t.same(getTenantContext(), { tenantId: "org_emit" });
        })
      );
    });

    emitter.emit("event");
    t.ok(called);
  }
);

t.test(
  "runWithTenant warns and still runs when tenant is invalid",
  async () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);

    try {
      let ran = false;
      const result = runWithTenant("", () => {
        ran = true;
        t.equal(
          getTenantContext(),
          undefined,
          "no tenant set for an invalid id"
        );
        return "done";
      });

      t.ok(ran);
      t.equal(result, "done");
      t.equal(warnings.length, 1);
      t.match(warnings[0], "expects a non-empty string or number");
    } finally {
      console.warn = originalWarn;
    }
  }
);

t.test(
  "runWithTenant warns and still runs when tenant is not a string or number",
  async () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (msg: string) => warnings.push(msg);

    try {
      let ran = false;
      // @ts-expect-error Testing invalid input
      const result = runWithTenant(null, () => {
        ran = true;
        t.equal(
          getTenantContext(),
          undefined,
          "no tenant set for an invalid id"
        );
        return "done";
      });

      t.ok(ran);
      t.equal(result, "done");
      t.equal(warnings.length, 1);
      t.match(warnings[0], "expects a non-empty string or number");
    } finally {
      console.warn = originalWarn;
    }
  }
);

t.test("runWithTenant warns when passed a non-function", async () => {
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (msg: string) => warnings.push(msg);

  try {
    // @ts-expect-error Testing invalid input
    runWithTenant("org_1", "not a function");

    t.equal(warnings.length, 1);
    t.match(warnings[0], "Expected a function, but received a value");
  } finally {
    console.warn = originalWarn;
  }
});

t.test("runWithTenant warns when sync callback returns a Promise", async () => {
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (msg: string) => warnings.push(msg);

  try {
    await runWithTenant("org_1", () => Promise.resolve("x"));

    t.equal(warnings.length, 1);
    t.match(warnings[0], "returned a Promise without awaiting it");
  } finally {
    console.warn = originalWarn;
  }
});

t.test("runWithTenant does not warn for async callbacks", async () => {
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (msg: string) => warnings.push(msg);

  try {
    await runWithTenant("org_1", async () => "x");

    t.equal(warnings.length, 0);
  } finally {
    console.warn = originalWarn;
  }
});

t.test("setTenantId sets the tenant for the current request", async () => {
  createTestAgent();
  let ran = false;

  runWithContext({ ...requestContext }, () => {
    setTenantId("org_req");
    t.same(getTenantContext(), { tenantId: "org_req" });
    ran = true;
  });
  t.ok(ran);

  t.equal(
    getTenantContext(),
    undefined,
    "tenant does not leak outside the request"
  );
});

t.test(
  "runWithTenant overrides the tenant from the request context",
  async () => {
    createTestAgent();
    let ran = false;

    // Mirrors the bug: queued work resumes inside another request's context.
    // The explicit runWithTenant tenant must win over the request's tenant.
    runWithContext({ ...requestContext }, () => {
      setTenantId("foreign");
      t.same(getTenantContext(), { tenantId: "foreign" });

      runWithTenant("correct", () => {
        t.same(getTenantContext(), { tenantId: "correct" });
        ran = true;
      });

      t.same(
        getTenantContext(),
        { tenantId: "foreign" },
        "request tenant restored after runWithTenant returns"
      );
    });
    t.ok(ran);
  }
);
