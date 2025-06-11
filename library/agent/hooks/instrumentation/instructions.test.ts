import * as t from "tap";
import {
  getBuiltinInterceptors,
  getPackageCallbackInfo,
  getPackageFileInstrumentationInstructions,
  setBuiltinsToInstrument,
  setPackagesToInstrument,
  shouldPatchBuiltin,
  shouldPatchFile,
  shouldPatchPackage,
} from "./instructions";
import { Package } from "../Package";
import { BuiltinModule } from "../BuiltinModule";
import {
  __instrumentInspectArgs,
  __instrumentModifyArgs,
  __instrumentModifyReturnValue,
} from "./injectedFunctions";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { wrapBuiltinExports } from "./wrapBuiltinExports";
import { Agent } from "../../Agent";

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
        operationKind: "sql_op",
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
        identifier: "foo.bar.js.baz.MethodDefinition.^1.0.0",
        inspectArgs: true,
        modifyArgs: false,
        modifyReturnValue: false,
        modifyArgumentsObject: false,
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

  t.match(getPackageCallbackInfo("foo.bar.js.baz.MethodDefinition.^1.0.0"), {
    pkgName: "foo",
    methodName: "baz",
    operationKind: "sql_op",
    funcs: {
      modifyArgs: undefined,
      modifyReturnValue: undefined,
    },
  });
  t.equal(
    typeof getPackageCallbackInfo("foo.bar.js.baz.MethodDefinition.^1.0.0")!
      .funcs.inspectArgs,
    "function"
  );
  t.same(getPackageCallbackInfo("foo.bar.js.baz.^1.0.1"), undefined);
  t.same(getPackageCallbackInfo(""), undefined);

  t.equal(pkgInspectArgsCalled, false);
  getPackageCallbackInfo("foo.bar.js.baz.MethodDefinition.^1.0.0")!.funcs
    .inspectArgs!([], undefined as any, undefined);
  t.equal(pkgInspectArgsCalled, true);

  t.equal(shouldPatchBuiltin("http"), true);
  t.equal(shouldPatchBuiltin("https"), false);

  t.same(getBuiltinInterceptors("http").length, 1);
  t.equal(builtinOnRequireCalled, false);
  getBuiltinInterceptors("http")[0]({}, { name: "http", type: "builtin" });
  t.equal(builtinOnRequireCalled, true);

  setPackagesToInstrument([]);
  setBuiltinsToInstrument([]);

  t.same(getPackageCallbackInfo("foo.bar.js.baz.^1.0.0"), undefined);
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
  let pkgModifyReturnValueCalled = false;

  const pkg = new Package("foo");
  pkg.withVersion("^1.0.0").addFileInstrumentation({
    path: "bar.js",
    functions: [
      {
        nodeType: "MethodDefinition",
        name: "baz",
        operationKind: undefined,
        inspectArgs: () => {
          pkgInspectArgsCalled = true;
        },
        modifyArgs: (args) => {
          pkgModifyArgsCalled = true;
          return [42];
        },
        modifyReturnValue: (args, returnValue, agent, subject) => {
          t.same(args, [1, 2, 3]);
          t.ok(agent instanceof Agent);
          t.same(subject, {});
          pkgModifyReturnValueCalled = true;
          return "test";
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
  __instrumentInspectArgs(
    "foo.bar.js.bazABCDEF.MethodDefinition.^1.0.0",
    [],
    "1.0.0",
    this
  );
  __instrumentModifyArgs(
    "foo.bar.js.bazABCDEF.MethodDefinition.^1.0.0",
    [],
    this
  );
  t.equal(pkgInspectArgsCalled, false);
  t.equal(pkgModifyArgsCalled, false);
  t.equal(pkgModifyReturnValueCalled, false);
  __instrumentInspectArgs(
    "foo.bar.js.baz.MethodDefinition.^1.0.0",
    [],
    "1.0.0",
    this
  );
  __instrumentModifyArgs("foo.bar.js.baz.MethodDefinition.^1.0.0", [], this);
  // No agent yet
  t.equal(pkgInspectArgsCalled, false);
  t.equal(pkgModifyArgsCalled, false);
  t.equal(pkgModifyReturnValueCalled, false);

  // Without agent
  t.same(wrapBuiltinExports("http", { a: 1 }), { a: 1 });

  createTestAgent();

  __instrumentInspectArgs(
    "foo.bar.js.bazABCDEF.MethodDefinition.^1.0.0",
    [],
    "1.0.0",
    this
  );
  __instrumentModifyArgs(
    "foo.bar.js.bazABCDEF.MethodDefinition.^1.0.0",
    [],
    this
  );
  t.equal(pkgInspectArgsCalled, false);
  t.equal(pkgModifyArgsCalled, false);
  t.equal(pkgModifyReturnValueCalled, false);

  __instrumentInspectArgs(
    "foo.bar.js.baz.MethodDefinition.^1.0.0",
    [],
    "1.0.0",
    this
  );
  t.equal(pkgInspectArgsCalled, true);
  t.same(
    __instrumentModifyArgs("foo.bar.js.baz.MethodDefinition.^1.0.0", [], this),
    [42]
  );
  t.equal(pkgModifyArgsCalled, true);

  t.equal(pkgModifyReturnValueCalled, false);
  t.same(
    __instrumentModifyReturnValue(
      "foo.bar.js.baz.MethodDefinition.^1.0.0",
      [1, 2, 3],
      "42",
      this
    ),
    "test"
  );
  t.equal(pkgModifyReturnValueCalled, true);

  t.equal(builtinOnRequireCalled, false);
  const wrapped = wrapBuiltinExports("http", {}) as any;
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
        operationKind: undefined,
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

  t.same(
    __instrumentModifyArgs(
      "foo.xyz.js.abc.MethodDefinition.^1.0.0",
      [1, 2, 3],
      this
    ),
    [1, 2, 3]
  );
  t.same(
    __instrumentModifyArgs(
      "foo.xyz.js.abc.MethodDefinition.^1.0.0",
      // @ts-expect-error Testing invalid input
      undefined,
      this
    ),
    []
  );
  t.same(
    __instrumentModifyArgs("foo.xyz.js.doesnotexist", [1, 2, 3], this),
    [1, 2, 3]
  );
  t.same(
    __instrumentModifyArgs(
      "foo.xyz.js.xyz.MethodDefinition.^1.0.0",
      [1, 2, 3],
      this
    ),
    [1, 2, 3]
  );
  t.same(
    __instrumentModifyArgs(
      "foo.xyz.js.xyz.MethodDefinition.^1.0.0",
      // @ts-expect-error Testing invalid input
      undefined,
      this
    ),
    []
  );

  // Return default export
  const builtin2 = new BuiltinModule("http2");
  builtin2.onRequire((exports) => {
    return "test";
  });

  setBuiltinsToInstrument([builtin2]);

  t.equal(wrapBuiltinExports("http2", {}), "test");

  // Throw error
  const builtin3 = new BuiltinModule("assert");
  builtin3.onRequire(() => {
    throw new Error("test");
  });

  setBuiltinsToInstrument([builtin3]);

  wrapBuiltinExports("assert", {});

  // Non existing package
  t.same(shouldPatchFile("abc123456", "foo.js"), false);
});

t.test("all injected functions handle errors", async (t) => {
  let callbackCalledCount = 0;

  const pkg = new Package("foo");
  pkg.withVersion("^1.0.0").addFileInstrumentation({
    path: "dist/test.mjs",
    functions: [
      {
        nodeType: "MethodDefinition",
        name: "abc",
        operationKind: "sql_op",
        inspectArgs: () => {
          ++callbackCalledCount;
          throw new Error("test");
        },
        modifyArgs: () => {
          ++callbackCalledCount;
          throw new Error("test");
        },
        modifyReturnValue: () => {
          ++callbackCalledCount;
          throw new Error("test");
        },
      },
    ],
  });

  setPackagesToInstrument([pkg]);
  createTestAgent();

  __instrumentInspectArgs(
    "foo.dist/test.mjs.abc.MethodDefinition.^1.0.0",
    [],
    "1.0.0",
    this
  );
  __instrumentModifyArgs(
    "foo.dist/test.mjs.abc.MethodDefinition.^1.0.0",
    [],
    this
  );
  t.same(
    __instrumentModifyArgs(
      "foo.dist/test.mjs.abc.MethodDefinition.^1.0.0",
      [],
      this
    ),
    []
  );
  t.same(
    __instrumentModifyReturnValue(
      "foo.dist/test.mjs.abc.MethodDefinition.^1.0.0",
      [],
      42,
      this
    ),
    42
  );

  t.equal(callbackCalledCount, 4);
});

t.test("add same instructions for multiple files", async (t) => {
  let callbackCalledCount = 0;

  const pkg = new Package("foo");
  pkg.withVersion("^1.0.0").addMultiFileInstrumentation(
    ["dist/test.mjs", "dist/test2.mjs"],
    [
      {
        nodeType: "MethodDefinition",
        name: "abc",
        operationKind: "sql_op",
        inspectArgs: () => {
          ++callbackCalledCount;
        },
      },
    ]
  );

  setPackagesToInstrument([pkg]);
  createTestAgent();

  __instrumentInspectArgs(
    "foo.dist/test.mjs.abc.MethodDefinition.^1.0.0",
    [],
    "1.0.0",
    this
  );
  __instrumentInspectArgs(
    "foo.dist/test2.mjs.abc.MethodDefinition.^1.0.0",
    [],
    "1.0.0",
    this
  );

  t.equal(callbackCalledCount, 2);
});
