import * as t from "tap";
import { Hooks } from "./Hooks";

t.test("package throws error if name is empty", async (t) => {
  const hooks = new Hooks();

  t.throws(() => hooks.addPackage(""));
});

t.test("withVersion throws error if version is empty", async (t) => {
  const hooks = new Hooks();
  const subject = hooks.addPackage("package");

  t.throws(() => subject.withVersion(""));
});

t.test("throws error if interceptor is not a function", async (t) => {
  const hooks = new Hooks();
  const vPackage = hooks.addPackage("package").withVersion("^1.0.0");

  // @ts-expect-error Testing invalid input
  t.throws(() => subject.onRequire(""));
});

t.test("returns require interceptors", async (t) => {
  const hooks = new Hooks();

  const interceptor = () => {};

  const vPackage = hooks.addPackage("package").withVersion("^1.0.0");
  vPackage.onRequire(interceptor);

  t.same(vPackage.getRequireInterceptors(), [interceptor]);
});

t.test("add builtin module throws if name is empty", async (t) => {
  const hooks = new Hooks();

  t.throws(() => hooks.addBuiltinModule(""));
});

t.test("it throws error if global name is empty", async () => {
  const hooks = new Hooks();

  t.throws(() => hooks.addGlobal(""));
});
