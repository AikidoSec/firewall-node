import * as t from "tap";
import { isAnyPkgAlreadyRequired } from "./isAnyPkgAlreadyRequired";
import { Hooks } from "../agent/hooks/Hooks";

// @esm-tests-skip

t.test("it works", async (t) => {
  const hooks = new Hooks();
  hooks.addPackage("express");
  hooks.addPackage("hono");

  t.equal(isAnyPkgAlreadyRequired(hooks.getPackages()), false);

  require("hono");

  t.equal(isAnyPkgAlreadyRequired(hooks.getPackages()), true);

  // Clear require cache
  for (const path in require.cache) {
    delete require.cache[path];
  }

  t.equal(isAnyPkgAlreadyRequired(hooks.getPackages()), false);

  require("express");

  t.equal(isAnyPkgAlreadyRequired(hooks.getPackages()), true);
});
