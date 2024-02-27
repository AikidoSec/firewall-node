import * as t from "tap";
import { wrap } from "./wrap";
import { Hooks } from "./Wrapper";

t.test("it ignores if package is not installed", async (t) => {
  const hooks = new Hooks();
  hooks.package("unknown").withVersion("^1.0.0");
  t.same(wrap(hooks), {});
});

t.test("it ignores if packages have empty selectors", async (t) => {
  const hooks = new Hooks();
  hooks.package("shimmer").withVersion("^1.0.0");
  t.same(wrap(hooks), {});
});

t.test("it ignores unknown selectors", async (t) => {
  const hooks = new Hooks();
  hooks
    .package("shimmer")
    .withVersion("^1.0.0")
    .subject((exports) => exports.doesNotExist)
    .method("method", () => {});
  t.same(wrap(hooks), {
    shimmer: {
      version: "1.2.1",
      supported: true,
    },
  });
});
