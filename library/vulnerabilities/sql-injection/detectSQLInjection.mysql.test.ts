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

t.test("It flags SET GLOBAL as SQL injection", async () => {
  isSqlInjection("SET GLOBAL max_connections = 1000", "GLOBAL max_connections");
  isSqlInjection(
    "SET @@GLOBAL.max_connections = 1000",
    "@@GLOBAL.max_connections = 1000"
  );
  isSqlInjection(
    "SET @@GLOBAL.max_connections=1000",
    "@@GLOBAL.max_connections=1000"
  );

  isNotSQLInjection(
    "SELECT * FROM users WHERE id = 'SET GLOBAL max_connections = 1000'",
    "SET GLOBAL max_connections = 1000"
  );
  isNotSQLInjection(
    "SELECT * FROM users WHERE id = 'SET @@GLOBAL.max_connections = 1000'",
    "SET @@GLOBAL.max_connections = 1000"
  );
});

t.test("It flags SET SESSION as SQL injection", async () => {
  isSqlInjection(
    "SET SESSION max_connections = 1000",
    "SESSION max_connections"
  );
  isSqlInjection(
    "SET @@SESSION.max_connections = 1000",
    "@@SESSION.max_connections = 1000"
  );
  isSqlInjection(
    "SET @@SESSION.max_connections=1000",
    "@@SESSION.max_connections=1000"
  );

  isNotSQLInjection(
    "SELECT * FROM users WHERE id = 'SET SESSION max_connections = 1000'",
    "SET SESSION max_connections = 1000"
  );
  isNotSQLInjection(
    "SELECT * FROM users WHERE id = 'SET @@SESSION.max_connections = 1000'",
    "SET @@SESSION.max_connections = 1000"
  );
});

t.test("It flags SET CHARACTER SET as SQL injection", async () => {
  isSqlInjection("SET CHARACTER SET utf8", "CHARACTER SET utf8");
  isSqlInjection("SET CHARACTER SET=utf8", "CHARACTER SET=utf8");
  isSqlInjection("SET CHARSET utf8", "CHARSET utf8");
  isSqlInjection("SET CHARSET=utf8", "CHARSET=utf8");

  isNotSQLInjection(
    "SELECT * FROM users WHERE id = 'SET CHARACTER SET utf8'",
    "SET CHARACTER SET utf8"
  );
  isNotSQLInjection(
    "SELECT * FROM users WHERE id = 'SET CHARACTER SET=utf8'",
    "SET CHARACTER SET=utf8"
  );
  isNotSQLInjection(
    "SELECT * FROM users WHERE id = 'SET CHARSET utf8'",
    "SET CHARSET utf8"
  );
  isNotSQLInjection(
    "SELECT * FROM users WHERE id = 'SET CHARSET=utf8'",
    "SET CHARSET=utf8"
  );
});

function isSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectMySQL()), true, sql);
}

function isNotSQLInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectMySQL()), false, sql);
}
