import * as t from "tap";
import { detectSQLInjection } from "./detectSQLInjection";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";

t.test("It flags MySQL bitwise operator as SQL injection", async () => {
  isSqlInjection("SELECT 10 ^ 12", "10 ^ 12");
});

t.test("It ignores postgres dollar signs", async () => {
  isNotSQLInjection("SELECT $$", "$$");
  isNotSQLInjection("SELECT $$text$$", "$$text$$");
  isNotSQLInjection("SELECT $tag$text$tag$", "$tag$text$tag$");
});

function isSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectMySQL()), true, sql);
}

function isNotSQLInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectMySQL()), false, sql);
}
