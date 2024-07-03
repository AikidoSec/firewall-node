import * as t from "tap";
import { detectSQLInjection } from "./detectSQLInjection";
import { SQLDialectSQLite } from "./dialects/SQLDialectSQLite";

t.test("It flags the VACUUM command as SQL injection", async () => {
  isSqlInjection("VACUUM;", "VACUUM");
});

t.test("It flags the ATTACH command as SQL injection", async () => {
  isSqlInjection("ATTACH DATABASE 'test.db' AS test;", "'test.db' AS test");
});

t.test("It ignores postgres dollar signs", async () => {
  isNotSQLInjection("SELECT $$", "$$");
  isNotSQLInjection("SELECT $$text$$", "$$text$$");
  isNotSQLInjection("SELECT $tag$text$tag$", "$tag$text$tag$");
});

function isSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectSQLite()), true, sql);
}

function isNotSQLInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectSQLite()), false, sql);
}
