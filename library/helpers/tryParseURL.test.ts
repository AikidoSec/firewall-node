import * as t from "tap";
import { tryParseURL } from "./tryParseURL";

t.test("it returns undefined for invalid URL", async (t) => {
  t.same(tryParseURL("http://"), undefined);
});

t.test("it returns URL object for valid URL", async (t) => {
  t.same(tryParseURL("http://localhost"), new URL("http://localhost"));
});

t.test("it returns undefined for invalid URL", async (t) => {
  t.same(tryParseURL("localhost"), undefined);
});
