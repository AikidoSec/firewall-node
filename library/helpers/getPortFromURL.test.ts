import * as t from "tap";
import { getPortFromURL } from "./getPortFromURL";

t.test("it works", async (t) => {
  t.same(getPortFromURL(new URL("http://localhost:4000")), 4000);
  t.same(getPortFromURL(new URL("http://localhost")), 80);
  t.same(getPortFromURL(new URL("https://localhost")), 443);
  t.same(getPortFromURL(new URL("ftp://localhost")), undefined);
});
