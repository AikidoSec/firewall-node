import t from "tap";
import { tryParseURL } from "./tryParseURL";

t.test("it returns undefined if invalid URL", async () => {
  const url = tryParseURL("invalid");
  t.same(url, undefined);
});

t.test("it returns URL if valid URL", async () => {
  const url = tryParseURL("https://example.com");
  t.same(url, new URL("https://example.com/"));
});
