import { readFileSync } from "fs";
import { join } from "path";
import * as t from "tap";
import { SQL_KEYWORDS } from "./config";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";
import { SQLDialectPostgres } from "./dialects/SQLDialectPostgres";
import { userInputContainsSQLSyntax } from "./userInputContainsSQLSyntax";

t.test("it flags dialect specific keywords", async () => {
  t.same(userInputContainsSQLSyntax("@@GLOBAL", new SQLDialectMySQL()), true);
});

t.test("it does not flag common SQL keywords", async () => {
  t.same(userInputContainsSQLSyntax("SELECT", new SQLDialectMySQL()), false);
});

t.test("it ignores alphanumeric input", async () => {
  t.same(userInputContainsSQLSyntax("1", new SQLDialectMySQL()), false);
  t.same(userInputContainsSQLSyntax("123", new SQLDialectMySQL()), false);
  t.same(userInputContainsSQLSyntax("1313", new SQLDialectMySQL()), false);
  t.same(userInputContainsSQLSyntax("0", new SQLDialectMySQL()), false);
  t.same(userInputContainsSQLSyntax("abc", new SQLDialectMySQL()), false);
  t.same(userInputContainsSQLSyntax("ABC", new SQLDialectMySQL()), false);
});

t.test("it does not flag SQL keyword as dangerous", async () => {
  // They just contain alpha characters
  SQL_KEYWORDS.forEach((keyword) => {
    t.same(
      userInputContainsSQLSyntax(keyword.toLowerCase(), new SQLDialectMySQL()),
      false
    );
    t.same(
      userInputContainsSQLSyntax(keyword.toUpperCase(), new SQLDialectMySQL()),
      false
    );
  });
});

const files = [
  // Taken from https://github.com/payloadbox/sql-injection-payload-list/tree/master
  join(__dirname, "payloads", "Auth_Bypass.txt"),
  join(__dirname, "payloads", "postgres.txt"),
  join(__dirname, "payloads", "mysql.txt"),
  join(__dirname, "payloads", "mssql_and_db2.txt"),
];

for (const file of files) {
  const contents = readFileSync(file, "utf-8");
  const lines = contents.split(/\r?\n/);
  for (const sql of lines) {
    t.test(`it flags dangerous SQL syntax: ${sql}`, async () => {
      t.same(userInputContainsSQLSyntax(sql, new SQLDialectMySQL()), true, sql);
      t.same(
        userInputContainsSQLSyntax(sql, new SQLDialectPostgres()),
        true,
        sql
      );
    });
  }
}
