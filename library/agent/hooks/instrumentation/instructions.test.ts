import * as t from "tap";
import {
  getBuiltinInterceptors,
  getPackageCallbacks,
  getPackageFileInstrumentationInstructions,
  setBuiltinsToInstrument,
  setPackagesToInstrument,
  shouldPatchBuiltin,
  shouldPatchPackage,
} from "./instructions";
import { Package } from "../Package";
import { BuiltinModule } from "../BuiltinModule";
import {
  __instrumentInspectArgs,
  __instrumentModifyArgs,
  __wrapBuiltinExports,
} from "./injectedFunctions";
import { createTestAgent } from "../../../helpers/createTestAgent";

t.test("it works", async (t) => {
  let pkgInspectArgsCalled = false;
  let builtinOnRequireCalled = false;

  const pkg = new Package("foo");
  pkg.withVersion("^1.0.0").addFileInstrumentation({
    path: "bar.js",
    functions: [
      {
        nodeType: "MethodDefinition",
        name: "baz",
        inspectArgs: () => {
          pkgInspectArgsCalled = true;
        },
      },
    ],
  });

  const builtin = new BuiltinModule("http");
  builtin.onRequire(() => {
    builtinOnRequireCalled = true;
  });

  setPackagesToInstrument([pkg]);
  setBuiltinsToInstrument([builtin]);

  t.equal(pkgInspectArgsCalled, false);
  t.equal(shouldPatchPackage("foo"), true);
  t.equal(shouldPatchPackage("bar"), false);
  t.same(getPackageFileInstrumentationInstructions("foo", "1.1.2", "bar.js"), {
    path: "bar.js",
    versionRange: "^1.0.0",
    functions: [
      {
        nodeType: "MethodDefinition",
        name: "baz",
        identifier: "foo.bar.js.baz.^1.0.0",
        inspectArgs: true,
        modifyArgs: false,
        modifyReturnValue: false,
      },
    ],
  });
  t.equal(
    getPackageFileInstrumentationInstructions("foo", "2.0.0", "bar.js"),
    undefined
  );
  t.equal(
    getPackageFileInstrumentationInstructions("foo", "0.1.0", "bar.js"),
    undefined
  );
  t.equal(
    getPackageFileInstrumentationInstructions("foo", "", "bar.js"),
    undefined
  );
  t.same(
    getPackageFileInstrumentationInstructions("foo", "1.1.2", "abc.js"),
    undefined
  );

  t.match(getPackageCallbacks("foo.bar.js.baz.^1.0.0"), {
    modifyArgs: undefined,
    modifyReturnValue: undefined,
  });
  t.equal(
    typeof getPackageCallbacks("foo.bar.js.baz.^1.0.0").inspectArgs,
    "function"
  );
  t.same(getPackageCallbacks("foo.bar.js.baz.^1.0.1"), {});
  t.same(getPackageCallbacks(""), {});

  t.equal(pkgInspectArgsCalled, false);
  getPackageCallbacks("foo.bar.js.baz.^1.0.0").inspectArgs!(
    [],
    undefined as any,
    undefined
  );
  t.equal(pkgInspectArgsCalled, true);

  t.equal(shouldPatchBuiltin("http"), true);
  t.equal(shouldPatchBuiltin("https"), false);

  t.same(getBuiltinInterceptors("http").length, 1);
  t.equal(builtinOnRequireCalled, false);
  getBuiltinInterceptors("http")[0]({}, { name: "http", type: "builtin" });
  t.equal(builtinOnRequireCalled, true);

  setPackagesToInstrument([]);
  setBuiltinsToInstrument([]);

  t.same(getPackageCallbacks("foo.bar.js.baz.^1.0.0"), {});
  t.equal(
    getPackageFileInstrumentationInstructions("foo", "1.1.2", "bar.js"),
    undefined
  );
  t.equal(shouldPatchPackage("foo"), false);
  t.equal(shouldPatchBuiltin("http"), false);
  t.same(getBuiltinInterceptors("http").length, 0);
});

t.test("it works using injected functions", async (t) => {
  let pkgInspectArgsCalled = false;
  let builtinOnRequireCalled = false;
  let pkgModifyArgsCalled = false;

  const pkg = new Package("foo");
  pkg.withVersion("^1.0.0").addFileInstrumentation({
    path: "bar.js",
    functions: [
      {
        nodeType: "MethodDefinition",
        name: "baz",
        inspectArgs: () => {
          pkgInspectArgsCalled = true;
        },
        modifyArgs: (args) => {
          pkgModifyArgsCalled = true;
          return [42];
        },
      },
    ],
  });

  const builtin = new BuiltinModule("http");
  builtin.onRequire((exports) => {
    exports.test = 42;
    builtinOnRequireCalled = true;
  });

  setPackagesToInstrument([pkg]);
  setBuiltinsToInstrument([builtin]);

  t.equal(pkgInspectArgsCalled, false);
  __instrumentInspectArgs("foo.bar.js.bazABCDEF.^1.0.0", []);
  __instrumentModifyArgs("foo.bar.js.bazABCDEF.^1.0.0", []);
  t.equal(pkgInspectArgsCalled, false);
  t.equal(pkgModifyArgsCalled, false);
  __instrumentInspectArgs("foo.bar.js.baz.^1.0.0", []);
  __instrumentModifyArgs("foo.bar.js.baz.^1.0.0", []);
  // No agent yet
  t.equal(pkgInspectArgsCalled, false);
  t.equal(pkgModifyArgsCalled, false);

  createTestAgent();

  __instrumentInspectArgs("foo.bar.js.bazABCDEF.^1.0.0", []);
  __instrumentModifyArgs("foo.bar.js.bazABCDEF.^1.0.0", []);
  t.equal(pkgInspectArgsCalled, false);
  t.equal(pkgModifyArgsCalled, false);

  __instrumentInspectArgs("foo.bar.js.baz.^1.0.0", []);
  t.equal(pkgInspectArgsCalled, true);
  t.same(__instrumentModifyArgs("foo.bar.js.baz.^1.0.0", []), [42]);
  t.equal(pkgModifyArgsCalled, true);

  t.equal(builtinOnRequireCalled, false);
  const wrapped = __wrapBuiltinExports("http", {}) as any;
  t.equal(builtinOnRequireCalled, true);
  t.equal(wrapped.test, 42);
});

t.test("modifyArgs always returns a array", async (t) => {
  const pkg = new Package("foo");
  pkg.withVersion("^1.0.0").addFileInstrumentation({
    path: "xyz.js",
    functions: [
      {
        nodeType: "MethodDefinition",
        name: "abc",
        modifyArgs: (args) => {
          return args;
        },
      },
      {
        nodeType: "MethodDefinition",
        name: "xyz",
        // @ts-expect-error Testing invalid input
        modifyArgs: (args) => {
          return undefined;
        },
      },
    ],
  });

  setPackagesToInstrument([pkg]);
  createTestAgent();

  t.same(__instrumentModifyArgs("foo.xyz.js.abc.^1.0.0", [1, 2, 3]), [1, 2, 3]);
  // @ts-expect-error Testing invalid input
  t.same(__instrumentModifyArgs("foo.xyz.js.abc.^1.0.0", undefined), []);
  t.same(
    __instrumentModifyArgs("foo.xyz.js.doesnotexist", [1, 2, 3]),
    [1, 2, 3]
  );
  t.same(__instrumentModifyArgs("foo.xyz.js.xyz.^1.0.0", [1, 2, 3]), [1, 2, 3]);
  // @ts-expect-error Testing invalid input
  t.same(__instrumentModifyArgs("foo.xyz.js.xyz.^1.0.0", undefined), []);
});

t.test("all injected functions handle errors", async (t) => {
  const pkg = new Package("foo");
  pkg.withVersion("^1.0.0").addFileInstrumentation({
    path: "dist/test.mjs",
    functions: [
      {
        nodeType: "MethodDefinition",
        name: "abc",
        inspectArgs: () => {
          throw new Error("test");
        },
        modifyArgs: () => {
          throw new Error("test");
        },
        modifyReturnValue: () => {
          throw new Error("test");
        },
      },
    ],
  });

  setPackagesToInstrument([pkg]);
  createTestAgent();

  __instrumentInspectArgs("foo.dist/test.mjs.abc.^1.0.0", []);
  __instrumentModifyArgs("foo.dist/test.mjs.abc.^1.0.0", []);
  t.same(__instrumentModifyArgs("foo.dist/test.mjs.abc.^1.0.0", []), []);
});
