/* eslint-disable camelcase */
import * as t from "tap";
import { extractStringsFromObject } from "./extractStringsFromObject";

t.test("empty object returns empty array", async () => {
  t.same(extractStringsFromObject({}), []);
});

t.test("it can extract query objects", async () => {
  t.same(extractStringsFromObject({ age: { $gt: "21" } }), [
    "age",
    "$gt",
    "21",
  ]);
  t.same(extractStringsFromObject({ title: { $ne: "null" } }), [
    "title",
    "$ne",
    "null",
  ]);
  t.same(
    extractStringsFromObject({
      age: "whaat",
      user_input: ["whaat", "dangerous"],
    }),
    ["user_input", "age", "whaat", "dangerous"]
  );
});

t.test("it can extract cookie objects", async () => {
  t.same(extractStringsFromObject({ session: "ABC", session2: "DEF" }), [
    "session2",
    "session",
    "ABC",
    "DEF",
  ]);
  t.same(extractStringsFromObject({ session: "ABC", session2: 1234 }), [
    "session2",
    "session",
    "ABC",
  ]);
});

t.test("it can extract header objects", async () => {
  t.same(
    extractStringsFromObject({
      "Content-Type": "application/json",
    }),
    ["Content-Type", "application/json"]
  );
  t.same(
    extractStringsFromObject({
      "Content-Type": 54321,
    }),
    ["Content-Type"]
  );
  t.notSame(
    extractStringsFromObject({
      "Content-Type": "application/json",
      ExtraHeader: "value",
    }),
    ["Content-Type", "application/json"]
  );
});

t.test("it can extract body objects", async () => {
  t.same(extractStringsFromObject({ nested: { nested: { $ne: null } } }), [
    "nested",
    "$ne",
  ]);

  t.same(extractStringsFromObject({ age: { $gt: "21", $lt: "100" } }), [
    "age",
    "$lt",
    "$gt",
    "21",
    "100",
  ]);
});

t.test("it decodes JWTs", async () => {
  t.same(
    extractStringsFromObject({
      token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbWUiOnsiJG5lIjpudWxsfSwiaWF0IjoxNTE2MjM5MDIyfQ._jhGJw9WzB6gHKPSozTFHDo9NOHs3CNOlvJ8rWy6VrQ",
    }),
    ["token", "iat", "username", "sub", "1234567890", "$ne"]
  );
});
