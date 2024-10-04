import t from "tap";
import { isAikidoCI } from "./isAikidoCI";

t.test("get aikido ci env", async (t) => {
  process.env.AIKIDO_CI = "true";
  t.ok(isAikidoCI());
  process.env.AIKIDO_CI = undefined;
  t.notOk(isAikidoCI());
  process.env.AIKIDO_CI = "1";
  t.ok(isAikidoCI());
  process.env.AIKIDO_CI = "false";
  t.notOk(isAikidoCI());
});
