import * as t from "tap";
import { applyHooks } from "./applyHooks";
import { Hooks } from "./hooks/Hooks";

t.test("it ignores if package is not installed", async (t) => {
  const hooks = new Hooks();
  hooks.addPackage("unknown").withVersion("^1.0.0");

  t.same(applyHooks(hooks), {});
});

t.test("it ignores if packages have empty selectors", async (t) => {
  const hooks = new Hooks();
  hooks.addPackage("shimmer").withVersion("^1.0.0");

  t.same(applyHooks(hooks), {
    shimmer: {
      version: "1.2.1",
      supported: false,
    },
  });
});

t.test("it ignores unknown selectors", async (t) => {
  const hooks = new Hooks();
  hooks
    .addPackage("shimmer")
    .withVersion("^1.0.0")
    .addSubject((exports) => exports.doesNotExist)
    .inspect("method", () => {});

  t.same(applyHooks(hooks), {
    shimmer: {
      version: "1.2.1",
      supported: true,
    },
  });

  // Force require to load shimmer
  require("shimmer");
});

t.test("it ignores if version is not supported", async (t) => {
  const hooks = new Hooks();
  hooks
    .addPackage("shimmer")
    .withVersion("^2.0.0")
    .addSubject((exports) => exports)
    .inspect("method", () => {});

  t.same(applyHooks(hooks), {
    shimmer: {
      version: "1.2.1",
      supported: false,
    },
  });
});
