import * as t from "tap";
import { detectSQLInjection } from "./detectSQLInjection";
import { SQLDialectPostgres } from "./dialects/SQLDialectPostgres";

t.test("It flags postgres bitwise operator as SQL injection", async () => {
  isSqlInjection("SELECT 10 # 12", "10 # 12");
});

t.test("It flags postgres type cast operator as SQL injection", async () => {
  isSqlInjection("SELECT abc::date", "abc::date");
});

t.test("Test PostgreSQL dollar signs", async (t) => {
  isNotSQLInjection(
    "SELECT * FROM users WHERE id = $$' OR 1=1 -- $$",
    "' OR 1=1 -- "
  );
  isNotSQLInjection(
    "SELECT * FROM users WHERE id = $$1; DROP TABLE users; -- $$",
    "1; DROP TABLE users; -- "
  );
  isSqlInjection(
    "SELECT * FROM users WHERE id = $$1$$ OR 1=1 -- $$",
    "1$$ OR 1=1 -- "
  );
});

t.test("Test PostgreSQL named dollar signs", async (t) => {
  isNotSQLInjection(
    "SELECT * FROM users WHERE id = $name$' OR 1=1 -- $name$",
    "' OR 1=1 -- "
  );

  isNotSQLInjection(
    "SELECT * FROM users WHERE id = $name$1; DROP TABLE users; -- $name$",
    "1; DROP TABLE users; -- "
  );
  isSqlInjection(
    "SELECT * FROM users WHERE id = $name$1$name$ OR 1=1 -- $name$",
    "1$name$ OR 1=1 -- "
  );
});

t.test("It flags CLIENT_ENCODING as SQL injection", async () => {
  isSqlInjection("SET CLIENT_ENCODING TO 'UTF8'", "CLIENT_ENCODING TO 'UTF8'");
  isSqlInjection("SET CLIENT_ENCODING = 'UTF8'", "CLIENT_ENCODING = 'UTF8'");
  isSqlInjection("SET CLIENT_ENCODING='UTF8'", "CLIENT_ENCODING='UTF8'");

  isNotSQLInjection(
    `SELECT * FROM users WHERE id = 'SET CLIENT_ENCODING = "UTF8"'`,
    `SET CLIENT_ENCODING = "UTF8"`
  );
  isNotSQLInjection(
    `SELECT * FROM users WHERE id = 'SET CLIENT_ENCODING TO "UTF8"'`,
    `SET CLIENT_ENCODING TO "UTF8"`
  );
});

function isSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectPostgres()), true, sql);
}

function isNotSQLInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectPostgres()), false, sql);
}
