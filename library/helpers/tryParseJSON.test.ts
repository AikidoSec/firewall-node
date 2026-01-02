import * as t from "tap";
import { tryParseJSON } from "./tryParseJSON";

t.test("tryParseJSON", async (t) => {
  t.test("valid JSON string", async (t) => {
    const jsonString = '{"name":"John","age":30}';
    const result = tryParseJSON(jsonString);
    t.same(result, { name: "John", age: 30 });
  });

  t.test("invalid JSON string", async (t) => {
    const jsonString = '{"name":"John","age":30'; // Missing closing brace
    const result = tryParseJSON(jsonString);
    t.equal(result, undefined);
  });

  t.test("empty string", async (t) => {
    const jsonString = "";
    const result = tryParseJSON(jsonString);
    t.equal(result, undefined);
  });

  t.test("non-string input", async (t) => {
    // @ts-expect-error Testing invalid input
    const result = tryParseJSON(new Date());
    t.equal(result, undefined);
  });
});
