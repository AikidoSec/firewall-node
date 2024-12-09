/* eslint-disable camelcase */
import * as t from "tap";
import { extractStringsFromUserInput } from "./extractStringsFromUserInput";

function fromArr(arr: string[]): Set<string> {
  return new Set(arr);
}

t.test("empty object returns empty array", async () => {
  t.same(extractStringsFromUserInput({}), fromArr([]));
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
      "iss",
    ])
  );
});

t.test("it also adds the JWT itself as string", async () => {
  t.same(
    extractStringsFromUserInput({ header: "/;ping%20localhost;.e30=." }),
    fromArr(["header", "/;ping%20localhost;.e30=."])
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
