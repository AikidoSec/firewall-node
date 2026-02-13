import * as t from "tap";
import { extractStringsFromUserInput } from "./extractStringsFromUserInput";

function fromArr(arr: string[]): Set<string> {
  return new Set(arr);
}

t.test("empty object returns empty array", async () => {
  t.same(extractStringsFromUserInput({}), fromArr([]));
});

t.test("empty strings are ignored", async () => {
  t.same(extractStringsFromUserInput({ abc: "" }), fromArr(["abc"]));
});

t.test("it can extract query objects", async () => {
  t.same(
    extractStringsFromUserInput({ age: { $gt: "21" } }),
    fromArr(["age", "$gt", "21"])
  );
  t.same(
    extractStringsFromUserInput({ title: { $ne: "null" } }),
    fromArr(["title", "$ne", "null"])
  );
  t.same(
    extractStringsFromUserInput({
      age: "whaat",
      user_input: ["whaat", "dangerous"],
    }),
    fromArr([
      "age",
      "whaat",
      "user_input",
      "whaat",
      "dangerous",
      "whaat,dangerous",
    ])
  );
});

t.test("it can extract cookie objects", async () => {
  t.same(
    extractStringsFromUserInput({ session: "ABC", session2: "DEF" }),
    fromArr(["session", "ABC", "session2", "DEF"])
  );
  t.same(
    extractStringsFromUserInput({ session: "ABC", session2: 1234 }),
    fromArr(["session", "ABC", "session2"])
  );
});

t.test("it can extract header objects", async () => {
  t.same(
    extractStringsFromUserInput({
      "Content-Type": "application/json",
    }),
    fromArr(["Content-Type", "application/json"])
  );
  t.same(
    extractStringsFromUserInput({
      "Content-Type": 54321,
    }),
    fromArr(["Content-Type"])
  );
  t.same(
    extractStringsFromUserInput({
      "Content-Type": "application/json",
      ExtraHeader: "value",
    }),
    fromArr(["Content-Type", "application/json", "ExtraHeader", "value"])
  );
});

t.test("it can extract body objects", async () => {
  t.same(
    extractStringsFromUserInput({ nested: { nested: { $ne: null } } }),
    fromArr(["nested", "$ne"])
  );

  t.same(
    extractStringsFromUserInput({ age: { $gt: "21", $lt: "100" } }),
    fromArr(["age", "$gt", "21", "$lt", "100"])
  );
});

t.test("it decodes JWTs", async () => {
  t.same(
    extractStringsFromUserInput({
      /**
       * {
       *   sub: "1234567890",
       *   username: {
       *     $ne: null,
       *   },
       *   iat: 1516239022,
       * }
       */
      token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbWUiOnsiJG5lIjpudWxsfSwiaWF0IjoxNTE2MjM5MDIyfQ._jhGJw9WzB6gHKPSozTFHDo9NOHs3CNOlvJ8rWy6VrQ",
    }),
    fromArr([
      "token",
      "iat",
      "username",
      "sub",
      "1234567890",
      "$ne",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbWUiOnsiJG5lIjpudWxsfSwiaWF0IjoxNTE2MjM5MDIyfQ._jhGJw9WzB6gHKPSozTFHDo9NOHs3CNOlvJ8rWy6VrQ",
      "username",
      "iat",
    ])
  );
});

t.test("it ignores iss value of jwt", async () => {
  t.same(
    extractStringsFromUserInput({
      /**
        {
          "sub": "1234567890",
          "name": "John Doe",
          "iat": 1516239022,
          "iss": "https://example.com"
        }
       */
      token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIn0.QLC0vl-A11a1WcUPD6vQR2PlUvRMsqpegddfQzPajQM",
    }),
    fromArr([
      "token",
      "iat",
      "sub",
      "1234567890",
      "name",
      "John Doe",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIn0.QLC0vl-A11a1WcUPD6vQR2PlUvRMsqpegddfQzPajQM",
    ])
  );
});

t.test("it also adds the JWT itself as string", async () => {
  t.same(
    extractStringsFromUserInput({ header: "/;ping%20localhost;.e30=." }),
    fromArr(["header", "/;ping%20localhost;.e30=.", "/;ping localhost;.e30=."])
  );
});

t.test("it concatenates array values", async () => {
  t.same(
    extractStringsFromUserInput({ arr: ["1", "2", "3"] }),
    fromArr(["arr", "1", "2", "3", "1,2,3"])
  );

  t.same(
    extractStringsFromUserInput({
      arr: ["1", 2, true, null, undefined, { test: "test" }],
    }),
    fromArr(["arr", "1", "test", "1,2,true,,,[object Object]"])
  );

  t.same(
    extractStringsFromUserInput({
      arr: ["1", 2, true, null, undefined, { test: ["test123", "test345"] }],
    }),
    fromArr([
      "arr",
      "1",
      "test",
      "test123",
      "test345",
      "test123,test345",
      "1,2,true,,,[object Object]",
    ])
  );
});

t.test("it decodes uri encoded strings", async () => {
  t.same(
    extractStringsFromUserInput({
      arr: ["1", "2", "3"],
      encoded: "%2E%2E/%2E%2Fetc%2Fpasswd",
    }),
    fromArr([
      "arr",
      "1",
      "2",
      "3",
      "1,2,3",
      "encoded",
      "%2E%2E/%2E%2Fetc%2Fpasswd",
      ".././etc/passwd",
    ])
  );
});

function buildNestedDictIterative(depth: number): Record<string, unknown> {
  let result: Record<string, unknown> = { a: "b" };
  for (let i = 1; i <= depth; i++) {
    const newLevel: Record<string, unknown> = {};
    newLevel[`key${i}`] = result;
    result = newLevel;
  }

  return result;
}

t.test("it handles deeply nested objects without stack overflow", async () => {
  const body = buildNestedDictIterative(10_000);
  body.name = "Test'), ('Test2');--";

  const result = extractStringsFromUserInput(body);
  t.ok(result.size > 0);
  t.ok(result.has("Test'), ('Test2');--"));
});

t.test("it handles deeply nested JWT without stack overflow", async () => {
  // Create deeply nested data for JWT payload - JSON.stringify would fail on this depth
  let nestedJson = '{"a":"b"}';
  for (let i = 1; i <= 10_000; i++) {
    nestedJson = `{"key${i}":${nestedJson}}`;
  }

  const payload = Buffer.from(nestedJson).toString("base64");
  const jwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.1234567890`;

  const input = {
    a: jwt,
    name: "Test'), ('Test2');--",
  };

  const result = extractStringsFromUserInput(input);
  t.ok(result.size > 0);
  t.ok(result.has("Test'), ('Test2');--"));
});

t.test("it does not use JWT claims that are URLs", async () => {
  /**
   * {
   *   "a": "b",
   *   "https://api.whatever.io/customer_id": "customer_id"
   * }
   */
  const jwt =
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6ImE3MzlmNGQxYTc1Njk2MzFjM2Q3ODRiZTgwZWMwM2RmIn0.eyJhIjoiYiIsImh0dHBzOi8vYXBpLndoYXRldmVyLmlvL2N1c3RvbWVyX2lkIjoiY3VzdG9tZXJfaWQifQ.eYnGoRZaxXkGUlkrWQ9Y2X6J0SMiddjc68K2b0R7nFaDHCasLArZc4095Oo0oHaJwf-R6f3T0Y_UNAe4Wmk7Tlv441SiCTd27bsNpdx0wvtiz2dew7PkbLy9YKKdH-liAa1musOHoG9oDF9MctYGQuC4_HscAgO1qB_syXz2NPFeHdvMN0GZHcFkxXdOL-DUg6D_tkG0RrfWTwyU8uFn6rImOh9_c4TRsmTSGDJ4pVY5jO6tci1dkGY_990ekRDLLxzN3hxA1zQX_tkFjqtJ8y4Bhei_FVi5C64pY41mf44V-qyHU0vy7mGbECqTtNsEqW_zLZGbyBt4Nna2Hc4q6BOiMBleWakcRV5A1cRyMruErn368nO5o9ZeWb2c8nSC5S-T9noWaF3AOkS00gj-Rqmwxk_j6kk4cC0ev3xjXKWmQCsoSvA3pBahXSpcYLwxa2J-LuEvQPNzP9GGFvZ0_ta4_iKD21_a49otfSRRu3ZZByRGryZ88UQpdNsWYXU-";
  t.same(
    extractStringsFromUserInput(jwt),
    fromArr([jwt, "a", "b", "customer_id"])
  );
});
