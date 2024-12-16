import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { Eval } from "./Eval";

const dangerousContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    calc: "1 + 1; console.log('hello')",
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

const safeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000/",
  query: {},
  headers: {},
  body: {
    calc: "1+ 1",
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("it detects JS injections using Eval", async (t) => {
  const agent = createTestAgent();
  agent.start([new Eval()]);

  t.same(eval("1 + 1"), 2);
  t.same(eval("1 + 1; console.log('hello')"), undefined);
  t.same(eval("const x = 1 + 1; x"), 2);

  runWithContext(dangerousContext, () => {
    t.same(eval("1 + 1"), 2);
    t.same(eval("const x = 1 + 1; x"), 2);

    const error = t.throws(() => eval("1 + 1; console.log('hello')"));
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.same(
        error.message,
        "Zen has blocked a JavaScript injection: eval(...) originating from body.calc"
      );
    }

    const error2 = t.throws(() =>
      eval("const test = 1 + 1; console.log('hello')")
    );
    t.ok(error2 instanceof Error);
    if (error2 instanceof Error) {
      t.same(
        error2.message,
        "Zen has blocked a JavaScript injection: eval(...) originating from body.calc"
      );
    }
  });

  runWithContext(safeContext, () => {
    t.same(eval("1 + 1"), 2);
    t.same(eval("const x = 1 + 1; x"), 2);
    t.same(eval("1 + 1; console.log('hello')"), undefined);
    t.same(eval("const test = 1 + 1; console.log('hello')"), undefined);
  });
});
