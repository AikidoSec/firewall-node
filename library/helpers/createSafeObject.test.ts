import * as t from "tap";
import { createSafeObject } from "./createSafeObject";

t.test("it creates an object with a null prototype", async (t) => {
  const obj = createSafeObject({});
  t.equal(Object.getPrototypeOf(obj), null);
  t.same(obj, Object.create(null));
});

t.test("it merges the given sources into the new object", async (t) => {
  const obj = createSafeObject({ a: 1 }, { b: 2 }, { a: 3 });
  t.equal(Object.getPrototypeOf(obj), null);
  t.equal(obj.a, 3);
  t.equal(obj.b, 2);
});

t.test("it does not mutate the given sources", async (t) => {
  const source = { a: 1 };
  const obj = createSafeObject(source);
  obj.a = 2;
  t.equal(source.a, 1);
  t.not(obj, source);
});

t.test("it is not vulnerable to prototype pollution via __proto__", async (t) => {
  const payload = JSON.parse('{"__proto__": {"polluted": true}}');
  const obj = createSafeObject(payload);

  t.equal(Object.getPrototypeOf(obj), null);
  t.same((Object.prototype as unknown as { polluted?: boolean }).polluted, undefined);
  t.ok(!("polluted" in {}));
});

t.test("it returns a plain merge when no sources are given", async (t) => {
  const obj = createSafeObject({});
  t.same(Object.keys(obj), []);
});
