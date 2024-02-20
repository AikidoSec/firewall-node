import * as t from "tap";
import { extract } from "./extractFromContext";

t.test("Can extract() extract Query objects", async () => {
  t.same(extract({ age: { $gt: "21" } }), ["age", "$gt", "21"]);
  t.same(extract({ title: { $ne: "null" } }), ["title", "$ne", "null"]);
  t.same(extract({ age: "whaat", user_input: ["whaat", "dangerous"]}), ["user_input", "age", "whaat", "dangerous"])
});

t.test("Can extract() extract cookie objects", async () => {
  t.same(extract({session: "ABC", session2: "DEF"}), ["session2", "session", "ABC", "DEF"])
})