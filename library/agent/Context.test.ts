import * as t from "tap";
import { type Context, getContext, runWithContext } from "./Context";

const sampleContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
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
