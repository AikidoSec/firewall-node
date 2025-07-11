import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { Function as FunctionWrapper } from "./Function";

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

t.test("it detects JS injections using Function", async (t) => {
  const agent = createTestAgent();
  agent.start([new FunctionWrapper()]);

  t.same(new Function("return 1 + 1")(), 2);
  t.same(new Function("1 + 1")(), undefined);
  t.same(new Function("const x = 1 + 1; return x")(), 2);

  t.same(
    new Function(
      "const sumArray = (arr) => arr.reduce((previousValue, currentValue) => previousValue + currentValue); return sumArray"
    )()([1, 2, 3]),
    6
  );

  t.same(
    Function(
      "function findLargestNumber (arr) { return Math.max(...arr) }; return findLargestNumber"
    )
      .call({})
      .call({}, [2, 4, 1, 8, 5]),
    8
  );
  t.same(new Function("a", "b", "return a + b")(2, 6), 8);
  t.same(new Function("inp = 9", "const test = inp; return test;")(), 9);
  t.same(new Function("a, b", "c = 5", "return a + b + c")(2, 6), 13);

  const error1 = t.throws(() => new Function("/*", "*/) {"));
  t.ok(error1 instanceof Error);
  if (error1 instanceof Error) {
    t.same(error1.message, "Unexpected end of arg string");
  }

  runWithContext(safeContext, () => {
    t.same(new Function("1 + 1")(), undefined);
    t.same(new Function("const x = 1 + 1; return x")(), 2);
  });

  runWithContext(dangerousContext, () => {
    t.same(new Function("1 + 1")(), undefined);
    t.same(new Function("const x = 1 + 1; return x")(), 2);

    const error = t.throws(() => new Function("1 + 1; console.log('hello')"));
    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.same(
        error.message,
        "Zen has blocked a JavaScript injection: new Function(...) originating from body.calc"
      );
    }

    const error2 = t.throws(
      () => new Function("const test = 1 + 1; console.log('hello')")
    );
    t.ok(error2 instanceof Error);
    if (error2 instanceof Error) {
      t.same(
        error2.message,
        "Zen has blocked a JavaScript injection: new Function(...) originating from body.calc"
      );
    }

    const error3 = t.throws(() =>
      new Function(
        "a, b",
        "c = 5",
        "const x = a + b + c + 1 + 1; console.log('hello'); return x;"
      )(2, 6)
    );
    t.ok(error3 instanceof Error);
    if (error3 instanceof Error) {
      t.same(
        error3.message,
        "Zen has blocked a JavaScript injection: new Function(...) originating from body.calc"
      );
    }
  });
});
