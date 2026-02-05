import * as t from "tap";
import {
  getBuiltinInterceptors,
  getFunctionCallbackInfo,
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
  __instrumentAccessLocalVariables,
  __instrumentInspectArgs,
  __instrumentModifyArgs,
  __instrumentModifyReturnValue,
  __instrumentPackageLoaded,
  __instrumentPackageWrapped,
} from "./injectedFunctions";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { wrapBuiltinExports } from "./wrapBuiltinExports";
import { Agent } from "../../Agent";
import { wrap } from "../../../helpers/wrap";
import { getInstance } from "../../AgentSingleton";

const consoleWarnings: string[] = [];

wrap(console, "warn", (originalLog) => {
  return function wrappedLog(...args: unknown[]) {
    consoleWarnings.push(args.join(" "));
    // @ts-expect-error Ignore type of this
    return originalLog.apply(this, args);
  };
});

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
    identifier: "foo.bar.js.^1.0.0",
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
    accessLocalVariables: [],
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

  t.match(getFunctionCallbackInfo("foo.bar.js.baz.MethodDefinition.^1.0.0"), {
    pkgName: "foo",
    methodName: "baz",
    operationKind: "sql_op",
    funcs: {
      modifyArgs: undefined,
      modifyReturnValue: undefined,
    },
  });
  t.equal(
    typeof getFunctionCallbackInfo("foo.bar.js.baz.MethodDefinition.^1.0.0")!
      .funcs.inspectArgs,
    "function"
  );
  t.same(getFunctionCallbackInfo("foo.bar.js.baz.^1.0.1"), undefined);
  t.same(getFunctionCallbackInfo(""), undefined);

  t.equal(pkgInspectArgsCalled, false);
  getFunctionCallbackInfo("foo.bar.js.baz.MethodDefinition.^1.0.0")!.funcs
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

  t.same(getFunctionCallbackInfo("foo.bar.js.baz.^1.0.0"), undefined);
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
          t.same(subject, undefined);
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
  __instrumentModifyReturnValue(
    "foo.bar.js.bazABCDEF.MethodDefinition.^1.0.0",
    [1, 2, 3],
    "42",
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
  __instrumentModifyReturnValue(
    "foo.bar.js.bazABCDEF.MethodDefinition.^1.0.0",
    [1, 2, 3],
    "42",
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
      undefined
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

t.test("test local variable access", async (t) => {
  let callbackCalledCount = 0;

  const pkg = new Package("foo");
  pkg.withVersion("^1.0.0").addFileInstrumentation({
    path: "dist/test.mjs",
    functions: [],
    accessLocalVariables: {
      names: ["testVar", "testVar2"],
      cb: (vars) => {
        ++callbackCalledCount;
        t.same(vars, [42, "hello"]);
      },
    },
  });

  setPackagesToInstrument([pkg]);

  __instrumentAccessLocalVariables(
    "foo.dist/test.mjs.^1.0.0--does-not-exist",
    []
  );
  __instrumentAccessLocalVariables("foo.dist/test.mjs.^1.0.0", [42, "hello"]);

  t.equal(callbackCalledCount, 1);

  const pkg2 = new Package("foo");
  pkg2.withVersion("^2.0.0").addFileInstrumentation({
    path: "dist/test.mjs",
    functions: [],
    accessLocalVariables: {
      names: ["testVar", "testVar2"],
      cb: (vars) => {
        ++callbackCalledCount;
        throw new Error("Error should be caught");
      },
    },
  });

  setPackagesToInstrument([pkg2]);

  __instrumentAccessLocalVariables("foo.dist/test.mjs.^2.0.0", []);

  t.equal(callbackCalledCount, 2);
});

t.test("addFileInstrumentation checks path", async (t) => {
  const pkg = new Package("foo").withVersion("^1.0.0");

  const error1 = t.throws(() => {
    pkg.addFileInstrumentation({
      path: "",
      functions: [],
    });
  });
  t.ok(error1 instanceof Error);
  if (error1 instanceof Error) {
    t.same(error1.message, "Path must not be empty");
  }

  const error2 = t.throws(() => {
    pkg.addFileInstrumentation({
      path: "/test",
      functions: [],
    });
  });
  t.ok(error2 instanceof Error);
  if (error2 instanceof Error) {
    t.same(error2.message, "Absolute paths are not allowed");
  }

  const error3 = t.throws(() => {
    pkg.addFileInstrumentation({
      path: "../test",
      functions: [],
    });
  });
  t.ok(error3 instanceof Error);
  if (error3 instanceof Error) {
    t.same(error3.message, "Relative paths with '..' are not allowed");
  }
});

t.test("instrumentPackageLoaded works", async (t) => {
  // Clear any previous warnings
  consoleWarnings.length = 0;

  __instrumentPackageLoaded("foo", "1.0.0", "0.0.0");

  t.same(consoleWarnings, []);

  // Wrong agent version
  __instrumentPackageLoaded("bar", "2.0.0", "99.0.0");
  t.equal(consoleWarnings.length, 1);
  t.match(
    consoleWarnings[0],
    "Aikido: Warning: A different version of the Aikido agent was used during bundling than the one running in the application. This may lead to unexpected behavior. Please ensure that the same version is used."
  );

  // @ts-expect-error Accessing private TS property
  const agentPackages = getInstance()?.packages;
  t.match(agentPackages?.asArray(), [
    {
      name: "foo",
      version: "1.0.0",
    },
    {
      name: "bar",
      version: "2.0.0",
    },
  ]);
});

t.test("instrumentPackageLoaded works", async (t) => {
  __instrumentPackageWrapped("foo", "1.0.0");
  __instrumentPackageWrapped("bar", "2.0.0");
  __instrumentPackageWrapped("@foo/bar", "1.2.3");

  // @ts-expect-error Calling private TS method
  const agentInfo = getInstance()?.getAgentInfo();

  t.same(agentInfo?.packages, {
    foo: "1.0.0",
    bar: "2.0.0",
    "@foo/bar": "1.2.3",
  });
});
