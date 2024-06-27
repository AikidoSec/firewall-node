import * as t from "tap";
import { Hooks } from "./Hooks";
import { VersionedPackage } from "./VersionedPackage";

t.test("package throws error if name is empty", async (t) => {
  const hooks = new Hooks();

  t.throws(() => hooks.addPackage(""));
});

t.test("withVersion throws error if version is empty", async (t) => {
  const hooks = new Hooks();
  const subject = hooks.addPackage("package");

  t.throws(() => subject.withVersion(""));
});

t.test("VersionedPackage throws error if name is empty", async (t) => {
  t.throws(() => new VersionedPackage("", "^1.0.0"));
});

t.test("file throws error if path is empty", async (t) => {
  const hooks = new Hooks();
  const subject = hooks.addPackage("package").withVersion("^1.0.0");

  t.throws(() => subject.addFile(""));
});

t.test("method throws error if name is empty", async (t) => {
  const hooks = new Hooks();
  const subject = hooks
    .addPackage("package")
    .withVersion("^1.0.0")
    .addSubject((exports) => exports);

  t.throws(() => subject.inspect("", () => {}));
  t.throws(() => subject.modifyArguments("", (args) => args));
  t.throws(() => subject.inspectResult("", (args, result) => {}));
});

t.test("add builtin module throws if name is empty", async (t) => {
  const hooks = new Hooks();

  t.throws(() => hooks.addBuiltinModule(""));
});

t.test("it throws error if global name is empty", async () => {
  const hooks = new Hooks();

  t.throws(() => hooks.addGlobal(""));
});

t.test("it throws if name is empty", async () => {
  const hooks = new Hooks();
  const subject = hooks
    .addPackage("package")
    .withVersion("^1.0.0")
    .addSubject((exports) => exports);

  t.throws(() => subject.inspectNewInstance(""));
});
