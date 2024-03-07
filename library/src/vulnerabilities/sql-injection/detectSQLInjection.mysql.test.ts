import { basename, join } from "path";
import * as t from "tap";
import { readFileSync } from "fs";
import { detectSQLInjection } from "./detectSQLInjection";
import { SQLDialectMySQL } from "./dialect/SQLDialectMySQL";

t.test("It flags MySQL bitwise operator as SQL injection", async () => {
  isSqlInjection("SELECT 10 ^ 12", "10 ^ 12");
});

const files = [
  join(__dirname, "payloads", "Auth_Bypass.txt"),
  join(__dirname, "payloads", "mysql.txt"),
];

for (const file of files) {
  const contents = readFileSync(file, "utf-8");
  const lines = contents.split(/\r?\n/);
  for (const sql of lines) {
    const source = `${sql} (${basename(file)})`;
    t.test(
      `It flags ${sql} from ${basename(file)} as SQL injection`,
      async () => {
        t.same(
          detectSQLInjection(sql, sql, new SQLDialectMySQL()),
          true,
          source
        );
      }
    );
  }
}

function isSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectMySQL()), true, sql);
}

function isNotSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectMySQL()), false, sql);
}
