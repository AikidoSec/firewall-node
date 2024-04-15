import * as t from "tap";
import { tryParseURL } from "./tryParseURL";

t.test("it works", async (t) => {
  t.same(tryParseURL("http://localhost"), new URL("http://localhost"));
  t.same(tryParseURL("http:/localhost"), new URL("http://localhost"));
  t.same(tryParseURL("http:localhost"), new URL("http://localhost"));
  t.same(tryParseURL("httplocalhost"), undefined);
});
