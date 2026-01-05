/* oxlint-disable no-implied-eval */
/* oxlint-disable no-eval */
import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { createTestAgent } from "../helpers/createTestAgent";
import { FunctionSink } from "./FunctionSink";

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
  agent.start([new FunctionSink()]);

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
        "Zen has blocked a JavaScript injection: new Function/eval(...) originating from body.calc"
      );
    }

    const error2 = t.throws(
      () => new Function("const test = 1 + 1; console.log('hello')")
    );
    t.ok(error2 instanceof Error);
    if (error2 instanceof Error) {
      t.same(
        error2.message,
        "Zen has blocked a JavaScript injection: new Function/eval(...) originating from body.calc"
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
        "Zen has blocked a JavaScript injection: new Function/eval(...) originating from body.calc"
      );
    }
  });

  t.same(eval("1 + 1"), 2);
  t.same(eval("const x = 2 + 2; x"), 4);
  t.same(eval("(() => 3 * 3)()"), 9);

  // Indirect eval
  t.same((0, eval)("1 + 1"), 2);
  t.same(eval.call(null, "2 + 2"), 4);

  runWithContext(safeContext, () => {
    t.same(eval("1 + 1"), 2);
    t.same(eval("const x = 1+ 1; x"), 2);
  });

  runWithContext(dangerousContext, () => {
    t.same(eval("1 + 1"), 2);
    t.same(eval("const x = 1 + 1; x"), 2);

    const error4 = t.throws(() => eval("1 + 1; console.log('hello')"));
    t.ok(error4 instanceof Error);
    if (error4 instanceof Error) {
      t.same(
        error4.message,
        "Zen has blocked a JavaScript injection: new Function/eval(...) originating from body.calc"
      );
    }

    const error5 = t.throws(() =>
      eval("const test = 1 + 1; console.log('hello')")
    );
    t.ok(error5 instanceof Error);
    if (error5 instanceof Error) {
      t.same(
        error5.message,
        "Zen has blocked a JavaScript injection: new Function/eval(...) originating from body.calc"
      );
    }

    // Indirect eval should also be blocked
    const error6 = t.throws(() => (0, eval)("1 + 1; console.log('hello')"));
    t.ok(error6 instanceof Error);
    if (error6 instanceof Error) {
      t.same(
        error6.message,
        "Zen has blocked a JavaScript injection: new Function/eval(...) originating from body.calc"
      );
    }
  });
});
