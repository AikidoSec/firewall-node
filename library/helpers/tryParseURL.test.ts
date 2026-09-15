import * as t from "tap";
import { tryParseURL } from "./tryParseURL";

t.test("it returns undefined if invalid URL", async () => {
  const url = tryParseURL("invalid");
  t.same(url, undefined);
});

t.test("it does not throw for large Base64 input", async (t) => {
  const hostname = Buffer.from('{\n\t"info": '.repeat(2_000)).toString(
    "base64"
  );
  t.doesNotThrow(() => tryParseURL(`http://${hostname}`));
});

t.test("it returns URL if valid URL", async () => {
  const url = tryParseURL("https://example.com");
  t.same(url, new URL("https://example.com/"));
});
