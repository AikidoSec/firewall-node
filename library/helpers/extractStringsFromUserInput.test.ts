/* eslint-disable camelcase */
import * as t from "tap";
import { extractStringsFromUserInput } from "./extractStringsFromUserInput";

t.test("empty object returns empty array", async () => {
  t.same(extractStringsFromUserInput({}), fromObj({}));
});

t.test("it can extract query objects", async () => {
  t.same(
    extractStringsFromUserInput({ age: { $gt: "21" } }),
    fromObj({
      age: ".",
      $gt: ".age",
      "21": ".age.$gt",
    })
  );
  t.same(
    extractStringsFromUserInput({ title: { $ne: "null" } }),
    fromObj({
      title: ".",
      $ne: ".title",
      null: ".title.$ne",
    })
  );
  t.same(
    extractStringsFromUserInput({
      age: "whaat",
      user_input: ["whaat", "dangerous"],
    }),
    fromObj({
      user_input: ".",
      age: ".",
      whaat: ".user_input.[0]",
      dangerous: ".user_input.[1]",
      "whaat,dangerous": ".user_input",
    })
  );
});

t.test("it can extract cookie objects", async () => {
  t.same(
    extractStringsFromUserInput({ session: "ABC", session2: "DEF" }),
    fromObj({
      session2: ".",
      session: ".",
      ABC: ".session",
      DEF: ".session2",
    })
  );
  t.same(
    extractStringsFromUserInput({ session: "ABC", session2: 1234 }),
    fromObj({
      session2: ".",
      session: ".",
      ABC: ".session",
    })
  );
});

t.test("it can extract header objects", async () => {
  t.same(
    extractStringsFromUserInput({
      "Content-Type": "application/json",
    }),
    fromObj({
      "Content-Type": ".",
      "application/json": ".Content-Type",
    })
  );
  t.same(
    extractStringsFromUserInput({
      "Content-Type": 54321,
    }),
    fromObj({
      "Content-Type": ".",
    })
  );
  t.same(
    extractStringsFromUserInput({
      "Content-Type": "application/json",
      ExtraHeader: "value",
    }),
    fromObj({
      "Content-Type": ".",
      "application/json": ".Content-Type",
      ExtraHeader: ".",
      value: ".ExtraHeader",
    })
  );
});

t.test("it can extract body objects", async () => {
  t.same(
    extractStringsFromUserInput({ nested: { nested: { $ne: null } } }),
    fromObj({
      nested: ".nested",
      $ne: ".nested.nested",
    })
  );

  t.same(
    extractStringsFromUserInput({ age: { $gt: "21", $lt: "100" } }),
    fromObj({
      age: ".",
      $lt: ".age",
      $gt: ".age",
      "21": ".age.$gt",
      "100": ".age.$lt",
    })
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
    fromObj({
      token: ".",
      iat: ".token<jwt>",
      username: ".token<jwt>",
      sub: ".token<jwt>",
      "1234567890": ".token<jwt>.sub",
      $ne: ".token<jwt>.username",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbWUiOnsiJG5lIjpudWxsfSwiaWF0IjoxNTE2MjM5MDIyfQ._jhGJw9WzB6gHKPSozTFHDo9NOHs3CNOlvJ8rWy6VrQ":
        ".token",
    })
  );
});

function fromObj(obj: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(obj));
}

t.test("it also adds the JWT itself as string", async () => {
  t.same(
    extractStringsFromUserInput({ header: "/;ping%20localhost;.e30=." }),
    fromObj({
      header: ".",
      "/;ping%20localhost;.e30=.": ".header",
    })
  );
});

t.test("it concatenates array values", async () => {
  t.same(
    extractStringsFromUserInput({ arr: ["1", "2", "3"] }),
    fromObj({
      arr: ".",
      "1,2,3": ".arr",
      "1": ".arr.[0]",
      "2": ".arr.[1]",
      "3": ".arr.[2]",
    })
  );

  t.same(
    extractStringsFromUserInput({
      arr: ["1", 2, true, null, undefined, { test: "test" }],
    }),
    fromObj({
      arr: ".",
      "1": ".arr.[0]",
      test: ".arr.[5].test",
      "1,2,true,,,[object Object]": ".arr",
    })
  );

  t.same(
    extractStringsFromUserInput({
      arr: ["1", 2, true, null, undefined, { test: ["test123", "test345"] }],
    }),
    fromObj({
      arr: ".",
      "1": ".arr.[0]",
      test: ".arr.[5]",
      test123: ".arr.[5].test.[0]",
      test345: ".arr.[5].test.[1]",
      "test123,test345": ".arr.[5].test",
      "1,2,true,,,[object Object]": ".arr",
    })
  );
});
