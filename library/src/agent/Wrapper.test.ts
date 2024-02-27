import * as t from "tap";
import { Hooks } from "./Wrapper";

t.test("package throws error if name is empty", async (t) => {
  const hooks = new Hooks();

  t.throws(() => hooks.package(""));
});

t.test("withVersion throws error if version is empty", async (t) => {
  const hooks = new Hooks();
  const subject = hooks.package("package");

  t.throws(() => subject.withVersion(""));
});

t.test("method throws error if name is empty", async (t) => {
  const hooks = new Hooks();
  const subject = hooks
    .package("package")
    .withVersion("^1.0.0")
    .subject((exports) => exports);

  t.throws(() => subject.method("", () => {}));
});
