/* oxlint-disable func-names */

import * as t from "tap";
import { isDeprecatedGenerator } from "./isDeprecatedGenerator";

t.test("should return true for generator functions", async (t) => {
  function* generator() {
    yield 1;
  }

  t.ok(isDeprecatedGenerator(generator));
  t.ok(isDeprecatedGenerator(function* () {}));
});

t.test("should return false for normal functions", async (t) => {
  function normal() {
    return 1;
  }

  t.notOk(isDeprecatedGenerator(normal));
});

t.test("should detect async generator functions", async (t) => {
  async function* asyncGenerator() {
    yield 1;
  }

  t.ok(isDeprecatedGenerator(asyncGenerator));
  t.ok(isDeprecatedGenerator(async function* () {}));
});

t.test("should return false for async functions", async (t) => {
  async function asyncFunction() {
    return 1;
  }

  t.notOk(isDeprecatedGenerator(asyncFunction));
  t.notOk(isDeprecatedGenerator(async () => {}));
});
