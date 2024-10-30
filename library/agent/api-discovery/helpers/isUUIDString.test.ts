import * as t from "tap";
import isUUIDString from "./isUUIDString";

t.test("it is a uuid", async (t) => {
  t.same(isUUIDString("550e8400-e29b-41d4-a716-446655440000"), true);
  t.same(isUUIDString("00000000-0000-0000-0000-000000000000"), true);
  t.same(isUUIDString("ffffffff-ffff-ffff-ffff-ffffffffffff"), true);
});

t.test("it is not a uuid", async (t) => {
  t.same(isUUIDString(""), false);
  t.same(isUUIDString("abc"), false);
  t.same(isUUIDString("550e8400-e29b-41d4-a716-44665544000"), false);
  t.same(isUUIDString("550e8400-e29b-41d4-a716-4466554400000"), false);
});
