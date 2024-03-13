import * as t from "tap";
import { detectSQLInjection } from "./detectSQLInjection";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";

t.test("It flags MySQL bitwise operator as SQL injection", async () => {
  isSqlInjection("SELECT 10 ^ 12", "10 ^ 12");
});

function isSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectMySQL()), true, sql);
}
