/* eslint-disable camelcase */
import * as t from "tap";
import { extractStringsFromUserInput } from "./extractStringsFromUserInput";

t.test("empty object returns empty array", async () => {
  t.same(extractStringsFromUserInput({}), []);
});

t.test("it can extract query objects", async () => {
  t.same(extractStringsFromUserInput({ age: { $gt: "21" } }), {
    age: ".",
    $gt: ".age",
    "21": ".age.$gt",
  });
  t.same(extractStringsFromUserInput({ title: { $ne: "null" } }), {
    title: ".",
    $ne: ".title",
    null: ".title.$ne",
  });
  t.same(
    extractStringsFromUserInput({
      age: "whaat",
      user_input: ["whaat", "dangerous"],
    }),
    {
      user_input: ".",
      age: ".",
      whaat: ".user_input.[0]",
      dangerous: ".user_input.[1]",
    }
  );
});

t.test("it can extract cookie objects", async () => {
  t.same(extractStringsFromUserInput({ session: "ABC", session2: "DEF" }), {
    session2: ".",
    session: ".",
    ABC: ".session",
    DEF: ".session2",
  });
  t.same(extractStringsFromUserInput({ session: "ABC", session2: 1234 }), {
    session2: ".",
    session: ".",
    ABC: ".session",
  });
});

t.test("it can extract header objects", async () => {
  t.same(
    extractStringsFromUserInput({
      "Content-Type": "application/json",
    }),
    {
      "Content-Type": ".",
      "application/json": ".Content-Type",
    }
  );
  t.same(
    extractStringsFromUserInput({
      "Content-Type": 54321,
    }),
    {
      "Content-Type": ".",
    }
  );
  t.notSame(
    extractStringsFromUserInput({
      "Content-Type": "application/json",
      ExtraHeader: "value",
    }),
    ["Content-Type", "application/json"]
  );
});

t.test("it can extract body objects", async () => {
  t.same(extractStringsFromUserInput({ nested: { nested: { $ne: null } } }), {
    nested: ".nested",
    $ne: ".nested.nested",
  });

  t.same(extractStringsFromUserInput({ age: { $gt: "21", $lt: "100" } }), {
    age: ".",
    $lt: ".age",
    $gt: ".age",
    "21": ".age.$gt",
    "100": ".age.$lt",
  });
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
    {
      token: ".",
      iat: ".token<jwt>",
      username: ".token<jwt>",
      sub: ".token<jwt>",
      "1234567890": ".token<jwt>.sub",
      $ne: ".token<jwt>.username",
    }
  );
});
