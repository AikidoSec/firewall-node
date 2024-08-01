import * as t from "tap";
import { isAikidoCI } from "./isAikidoCI";

t.test("detects GitHub Actions in Repo AikidoSec/firewall-node", async (t) => {
  process.env.GITHUB_ACTION_REPOSITORY = "AikidoSec/firewall-node";
  t.ok(isAikidoCI());
  process.env.GITHUB_ACTION_REPOSITORY = undefined;
  t.notOk(isAikidoCI());
  process.env.GITHUB_ACTION_REPOSITORY = "aikidosec/firewall-node";
  t.ok(isAikidoCI());
  process.env.GITHUB_ACTION_REPOSITORY = "another/repo";
  t.notOk(isAikidoCI());
});
