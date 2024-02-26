import * as t from "tap";
import { extractStringsFromContext } from "./extractStringsFromContext";

t.test("extractStringsFromContext()", async () => {
  t.same(
    extractStringsFromContext({
      cookies: { roses: "are" },
      body: { nested: ["nesting is not", ["fun"]] },
      query: {},
      headers: {
        "Content-Type": "Awesome/Content",
      },
      url: "",
      method: "GET",
      remoteAddress: "",
    }),
    [
      "Content-Type",
      "Awesome/Content",
      "roses",
      "are",
      "nested",
      "nesting is not",
      "fun",
    ]
  );
});
