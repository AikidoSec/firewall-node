import { basename, join } from "path";
import * as t from "tap";
import { readFileSync } from "fs";
import { dangerousCharsInInput } from "./dangerousCharsInInput";
import { detectSQLInjection } from "./detectSQLInjection";
import { SQLDialectPostgres } from "./dialect/SQLDialectPostgres";

t.test("It flags postgres bitwise operator as SQL injection", async () => {
  isSqlInjection("SELECT 10 # 12", "10 # 12");
});

t.test("It flags postgres type cast operator as SQL injection", async () => {
  isSqlInjection("SELECT abc::date", "abc::date");
});

const files = [join(__dirname, "payloads", "postgres.txt")];

for (const file of files) {
  const contents = readFileSync(file, "utf-8");
  const lines = contents.split(/\r?\n/);
  for (const sql of lines) {
    const source = `${sql} (${basename(file)})`;
    t.test(
      `It flags ${sql} from ${basename(file)} as SQL injection`,
      async () => {
        t.same(
          detectSQLInjection(sql, sql, new SQLDialectPostgres()),
          true,
          source
        );
      }
    );
  }
}

function isSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectPostgres()), true, sql);
}

function isNotSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectPostgres()), false, sql);
}
