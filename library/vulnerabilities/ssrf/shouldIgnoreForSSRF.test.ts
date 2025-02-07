import * as t from "tap";
import { shouldIgnoreForSSRF } from "./shouldIgnoreForSSRF";

t.test("it returns true", async (t) => {
  t.same(
    shouldIgnoreForSSRF({
      source: "headers",
      paths: [".host"],
    }),
    true
  );
  t.same(
    shouldIgnoreForSSRF({
      source: "headers",
      paths: [".origin"],
    }),
    true
  );
  t.same(
    shouldIgnoreForSSRF({
      source: "headers",
      paths: [".referer"],
    }),
    true
  );
});

t.test("it returns false", async (t) => {
  t.same(
    shouldIgnoreForSSRF({
      source: "headers",
      paths: [".host", ".test"],
    }),
    false
  );
  t.same(
    shouldIgnoreForSSRF({
      source: "body",
      paths: [".test"],
    }),
    false
  );
  t.same(
    shouldIgnoreForSSRF({
      source: "headers",
      paths: [".test"],
    }),
    false
  );
  t.same(
    shouldIgnoreForSSRF({
      source: "headers",
      paths: [".host", ".origin", ".referer", ".0"],
    }),
    false
  );
});
