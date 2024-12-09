import * as t from "tap";
import { getPathsToPayload as get } from "./attackPath";

t.test("it gets paths to payload", async (t) => {
  const testObj1 = {
    a: {
      b: {
        c: "payload",
      },
    },
    d: [12, "test", "payload"],
  };

  t.same(get("payload", testObj1), [".a.b.c", ".d.[2]"]);
  t.same(get("test", testObj1), [".d.[1]"]);
  t.same(get("notfound", testObj1), []);

  t.same(get("payload", "payload"), ["."]);
  t.same(get("test", "payload"), []);

  t.same(get("", undefined), []);
  t.same(get("", null), []);
  t.same(
    get("", () => {}),
    []
  );

  t.same(
    get("string", [
      "string",
      1,
      true,
      null,
      undefined,
      { test: "test" },
      "string",
    ]),
    [".[0]", ".[6]"]
  );

  // Concatenates array values
  t.same(get("test,test2", ["test", "test2"]), ["."]);
  t.same(get("test,test2", { test: { x: ["test", "test2"] } }), [".test.x"]);
});

t.test("it works with jwt", async (t) => {
  const testObj2 = {
    a: {
      x: ["test", "notfoundx"],
      b: {
        c: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.uG3R-hTeSn-DUddaexdXHw4pvXwKdyxqsD2k0BZrbd4",
      },
    },
  };

  t.same(get("John Doe", testObj2), [".a.b.c<jwt>.name"]);
  t.same(get("1234567890", testObj2), [".a.b.c<jwt>.sub"]);
  t.same(get("notfound", testObj2), []);
});

t.test("maximum match count of 10", async (t) => {
  const testArr = Array.from({ length: 20 }, () => "test");

  t.same(get("test", testArr), [
    ".[0]",
    ".[1]",
    ".[2]",
    ".[3]",
    ".[4]",
    ".[5]",
    ".[6]",
    ".[7]",
    ".[8]",
    ".[9]",
  ]);
});
