import * as t from "tap";
import { extract } from "./extractFromContext";

t.test("Can extract() extract Query objects", async () => {
  t.same(extract({ age: { $gt: "21" } }), ["age", "$gt", "21"]);
  t.same(extract({ title: { $ne: "null" } }), ["title", "$ne", "null"]);
  t.same(extract({ age: "whaat", user_input: ["whaat", "dangerous"] }), [
    "user_input",
    "age",
    "whaat",
    "dangerous",
  ]);
});

t.test("Can extract() extract cookie objects", async () => {
  t.same(extract({ session: "ABC", session2: "DEF" }), [
    "session2",
    "session",
    "ABC",
    "DEF",
  ]);
  t.same(extract({ session: "ABC", session2: 1234 }), [
    "session2",
    "session",
    "ABC",
  ]);
});

t.test("Can extract() extract header objects", async () => {
  t.same(
    extract({
      "Content-Type": "application/json",
    }),
    ["Content-Type", "application/json"]
  );
  t.same(
    extract({
      "Content-Type": 54321,
    }),
    ["Content-Type"]
  );
  t.notSame(
    extract({
      "Content-Type": "application/json",
      ExtraHeader: "value",
    }),
    ["Content-Type", "application/json"]
  );
});
