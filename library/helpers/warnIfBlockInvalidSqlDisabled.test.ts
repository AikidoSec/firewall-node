import * as t from "tap";
import { warnIfBlockInvalidSqlDisabled } from "./warnIfBlockInvalidSqlDisabled";

const logs: string[] = [];
// oxlint-disable-next-line no-console
console.log = function log(message: string) {
  logs.push(message);
};

t.beforeEach(() => {
  delete process.env.AIKIDO_BLOCK_INVALID_SQL;
  logs.length = 0;
});

t.test("it warns when AIKIDO_BLOCK_INVALID_SQL is not set", async (t) => {
  warnIfBlockInvalidSqlDisabled();

  t.match(logs, [/AIKIDO_BLOCK_INVALID_SQL=true/]);
});

t.test("it does not warn when AIKIDO_BLOCK_INVALID_SQL is true", async (t) => {
  process.env.AIKIDO_BLOCK_INVALID_SQL = "true";

  warnIfBlockInvalidSqlDisabled();

  t.same(logs, []);
});

t.test("it warns when AIKIDO_BLOCK_INVALID_SQL is false", async (t) => {
  process.env.AIKIDO_BLOCK_INVALID_SQL = "false";

  warnIfBlockInvalidSqlDisabled();

  t.match(logs, [/AIKIDO_BLOCK_INVALID_SQL=true/]);
});
