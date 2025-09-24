import * as t from "tap";
import { createTestAgent } from "../../../helpers/createTestAgent";
import { Hooks } from "../Hooks";
import {
  getBuiltinModuleWithoutPatching,
  patchProcessGetBuiltinModule,
} from "./processGetBuiltin";
import { setBuiltinsToInstrument } from "./instructions";
import { isEsmUnitTest } from "../../../helpers/isEsmUnitTest";

t.test(
  "it works",
  {
    skip: !("getBuiltinModule" in process)
      ? "Recent Node.js version required"
      : false,
  },
  async (t) => {
    createTestAgent();

    if (!isEsmUnitTest()) {
      // Before patched
      t.same(getBuiltinModuleWithoutPatching("http"), require("http"));
    }

    patchProcessGetBuiltinModule();

    const hooks = new Hooks();
    hooks.addBuiltinModule("http").onRequire((exports, pkgInfo) => {
      exports.test = 42;
    });

    hooks.addBuiltinModule("assert").onRequire((exports, pkgInfo) => {
      throw new Error("This should be catched");
    });

    // @ts-expect-error Ignore original types
    t.same(process.getBuiltinModule("http").test, undefined);
    // @ts-expect-error Ignore original types
    t.same(getBuiltinModuleWithoutPatching("http").test, undefined);

    setBuiltinsToInstrument(hooks.getBuiltInModules());

    // @ts-expect-error Ignore original types
    t.same(getBuiltinModuleWithoutPatching("http").test, undefined);
    // @ts-expect-error Ignore original types
    t.same(process.getBuiltinModule("http").test, 42);
    // @ts-expect-error Ignore original types
    t.same(getBuiltinModuleWithoutPatching("http").test, 42); // If the patch is already applied, it returns the patched version

    // @ts-expect-error Ignore original types
    t.same(process.getBuiltinModule("http2").test, undefined);

    const assert = require("assert");
    t.same(typeof assert.ok, "function");

    // Invalid args
    t.throws(() => {
      // @ts-expect-error Ignore original types
      getBuiltinModuleWithoutPatching(undefined);
    });
  }
);
