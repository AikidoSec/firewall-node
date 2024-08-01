import { readFileSync } from "fs";
import { join } from "path";
import * as t from "tap";
import { SQL_DANGEROUS_IN_STRING, SQL_KEYWORDS } from "./config";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";
import { SQLDialectPostgres } from "./dialects/SQLDialectPostgres";
import { SQLDialectSQLite } from "./dialects/SQLDialectSQLite";
import { userInputContainsSQLSyntax } from "./userInputContainsSQLSyntax";

t.test("it flags dialect specific keywords", async () => {
  t.same(userInputContainsSQLSyntax("@@GLOBAL", new SQLDialectMySQL()), true);
});

t.test("it does not flag common SQL keywords", async () => {
  t.same(userInputContainsSQLSyntax("SELECT", new SQLDialectMySQL()), false);
});

const alphanumeric = ["1", "123", "1313", "0", "abc", "ABC"];

t.test("it ignores alphanumeric input", async () => {
  alphanumeric.forEach((input) => {
    t.same(userInputContainsSQLSyntax(input, new SQLDialectMySQL()), false);
    t.same(userInputContainsSQLSyntax(input, new SQLDialectPostgres()), false);
    t.same(userInputContainsSQLSyntax(input, new SQLDialectSQLite()), false);
  });
});

t.test("it flags alphanumeric input if contains dangerous string", async () => {
  alphanumeric.forEach((input) => {
    SQL_DANGEROUS_IN_STRING.forEach((string) => {
      const payload = `${input}${string}`;
      t.same(userInputContainsSQLSyntax(payload, new SQLDialectMySQL()), true);
      t.same(
        userInputContainsSQLSyntax(payload, new SQLDialectPostgres()),
        true
      );
      t.same(userInputContainsSQLSyntax(payload, new SQLDialectSQLite()), true);
    });
  });
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

t.test("it does flag SQL keyword as dangerous if contains space", async () => {
  // They just contain alpha characters
  SQL_KEYWORDS.forEach((keyword) => {
    const payload = ` ${keyword}`;
    t.same(
      userInputContainsSQLSyntax(payload.toLowerCase(), new SQLDialectMySQL()),
      true
    );
    t.same(
      userInputContainsSQLSyntax(payload.toUpperCase(), new SQLDialectMySQL()),
      true
    );
  });
});

t.test(
  "it does flag SQL keyword as dangerous if contains dangerous string",
  async () => {
    // They just contain alpha characters
    SQL_KEYWORDS.forEach((keyword) => {
      SQL_DANGEROUS_IN_STRING.forEach((string) => {
        const payload = `${keyword}${string}`;
        t.same(
          userInputContainsSQLSyntax(
            payload.toLowerCase(),
            new SQLDialectMySQL()
          ),
          true
        );
        t.same(
          userInputContainsSQLSyntax(
            payload.toUpperCase(),
            new SQLDialectMySQL()
          ),
          true
        );
      });
    });
  }
);

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
