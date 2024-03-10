import { basename, join } from "path";
import * as t from "tap";
import { detectSQLInjection } from "./detectSQLInjection";
import { SQLDialectMySQL } from "./dialect/SQLDialectMySQL";
import { getLines } from "./testUtils";

const dialect = new SQLDialectMySQL();

t.test("It flags MySQL bitwise operator as SQL injection", async () => {
  t.same(detectSQLInjection("SELECT 10 ^ 12", "10 ^ 12", dialect), true);
});

const files = [
  join(__dirname, "payloads", "Auth_Bypass.txt"),
  join(__dirname, "payloads", "mysql.txt"),
];

function quote(input: string) {
  return `'${input.replace(/'/g, "''")}'`;
}

t.test(
  `it does not flag SQL injection payloads as SQL injections if properly escaped`,
  async () => {
    for (const file of files) {
      for (const payload of getLines(file)) {
        t.same(
          detectSQLInjection(
            `SELECT * FROM users WHERE id = ${quote(payload)}`,
            payload,
            dialect
          ),
          false,
          `${payload} (${basename(file)})`
        );
      }
    }
  }
);

t.test(
  "it flags payloads as SQL injections if not properly escaped",
  async () => {
    for (const file of files) {
      for (const payload of getLines(file)) {
        t.same(
          detectSQLInjection(payload, payload, dialect),
          true,
          `${payload} (${basename(file)})`
        );
      }
    }
  }
);
