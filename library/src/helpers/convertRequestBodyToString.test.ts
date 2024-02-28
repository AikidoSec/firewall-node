import * as t from "tap";
import { convertRequestBodyToString } from "./convertRequestBodyToString";

t.test("it converts object body to JSON string", async (t) => {
  t.same(
    convertRequestBodyToString({ a: 1, b: 2, c: 3 }),
    JSON.stringify({ a: 1, b: 2, c: 3 }, null, 2)
  );
});

t.test("it converts string body to string", async (t) => {
  t.same(convertRequestBodyToString("hello"), "hello");
});

t.test("it returns undefined for non-plain object", async (t) => {
  t.same(convertRequestBodyToString(new Date()), undefined);
});

t.test("it limits length to maxLength", async (t) => {
  t.same(convertRequestBodyToString("a".repeat(16385)), "a".repeat(16384));
});

t.test("it returns undefined for circular object", async (t) => {
  const obj: Record<string, unknown> = {};
  obj.a = obj;

  t.same(convertRequestBodyToString(obj), undefined);
});
