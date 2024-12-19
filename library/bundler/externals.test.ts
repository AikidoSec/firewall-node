import * as t from "tap";
import { externals } from "./externals";

t.test("it returns externals", async (t) => {
  t.ok(externals().includes("@aikidosec/firewall"));
  t.ok(externals().includes("pg"));
  t.ok(externals().includes("mysql"));
});
