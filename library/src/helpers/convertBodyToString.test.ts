import * as t from "tap";
import { convertBodyToString } from "./convertBodyToString";

t.test("it converts object body to JSON string", async (t) => {
  t.same(
    convertBodyToString({ a: 1, b: 2, c: 3 }),
    JSON.stringify({ a: 1, b: 2, c: 3 }, null, 2)
  );
});

t.test("it converts string body to string", async (t) => {
  t.same(convertBodyToString("hello"), "hello");
});

t.test("it returns undefined for non-plain object", async (t) => {
  t.same(convertBodyToString(new Date()), undefined);
});

t.test("it limits length to maxLength", async (t) => {
  t.same(convertBodyToString("a".repeat(16385)), "a".repeat(16384));
});

t.test("it returns undefined for circular object", async (t) => {
  const obj: Record<string, unknown> = {};
  obj.a = obj;

  t.same(convertBodyToString(obj), undefined);
});
