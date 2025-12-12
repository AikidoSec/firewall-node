import { basename, join } from "path";
import * as t from "tap";
import { readFileSync } from "fs";
import { escapeStringRegexp } from "../../helpers/escapeStringRegexp";
import {
  detectSQLInjection,
  SQLInjectionDetectionResult,
} from "./detectSQLInjection";
import { SQLDialectClickHouse } from "./dialects/SQLDialectClickHouse";
import { SQLDialectGeneric } from "./dialects/SQLDialectGeneric";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";
import { SQLDialectPostgres } from "./dialects/SQLDialectPostgres";
import { SQLDialectSQLite } from "./dialects/SQLDialectSQLite";

t.test("It ignores invalid queries", async () => {
  isTokenizeError("SELECT * FROM users WHERE id = 'users\\'", "users\\", [
    new SQLDialectMySQL(),
    // Postgres and others treat the backslash as a normal character
  ]);
});

t.test("It ignores safely escaped backslash", async () => {
  isNotSqlInjection("SELECT * FROM users WHERE id = 'users\\\\'", "users\\\\");
});

t.test("It allows escape sequences", async (t) => {
  isNotSqlInjection("SELECT * FROM users WHERE id = '\nusers'", "\nusers");
  isNotSqlInjection("SELECT * FROM users WHERE id = '\rusers'", "\rusers");
  isNotSqlInjection("SELECT * FROM users WHERE id = '\tusers'", "\tusers");
});

t.test("user input inside IN (...)", async () => {
  isNotSqlInjection("SELECT * FROM users WHERE id IN ('123')", "'123'");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (123)", "123");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (123, 456)", "123");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (123, 456)", "456");
  isNotSqlInjection("SELECT * FROM users WHERE id IN ('123')", "123");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (13,14,15)", "13,14,15");
  isNotSqlInjection(
    "SELECT * FROM users WHERE id IN (13, 14, 154)",
    "13, 14, 154"
  );
  isSqlInjection(
    "SELECT * FROM users WHERE id IN (13, 14, 154) OR (1=1)",
    "13, 14, 154) OR (1=1"
  );
});

t.test("It checks whether the string is safely escaped", async () => {
  isTokenizeError(
    `SELECT * FROM comments WHERE comment = 'I'm writting you'`,
    "I'm writting you"
  );
  isTokenizeError(
    `SELECT * FROM comments WHERE comment = "I"m writting you"`,
    'I"m writting you'
  );

  isNotSqlInjection(
    `SELECT * FROM comments WHERE comment = "I'm writting you"`,
    "I'm writting you"
  );
  isNotSqlInjection(
    `SELECT * FROM comments WHERE comment = 'I"m writting you'`,
    'I"m writting you'
  );
  isNotSqlInjection(
    `SELECT * FROM comments WHERE comment = "I\`m writting you"`,
    "I`m writting you"
  );
});

t.test(
  "it does not flag queries starting with SELECT and having select in user input",
  async () => {
    isNotSqlInjection("SELECT * FROM users WHERE id = 1", "SELECT");
  }
);

t.test("It does not flag escaped # as SQL injection", async () => {
  isNotSqlInjection(
    "SELECT * FROM hashtags WHERE name = '#hashtag'",
    "#hashtag"
  );
});

// Weird edge case, but we'll flag 'em as SQL injections for now
// Requires better understanding of the SQL syntax
t.test("Comment is same as user input", async () => {
  isSqlInjection(
    "SELECT * FROM hashtags WHERE name = '-- Query by name' -- Query by name",
    "-- Query by name"
  );
});

t.test("input occurs in comment", async () => {
  isNotSqlInjection(
    "SELECT * FROM hashtags WHERE name = 'name' -- Query by name",
    "name"
  );
});

t.test("User input is multiline", async () => {
  isSqlInjection(
    `SELECT * FROM users WHERE id = 'a'
OR 1=1#'`,
    `a'
OR 1=1#`,
    [new SQLDialectGeneric(), new SQLDialectMySQL()]
  );

  isNotSqlInjection(
    `SELECT * FROM users WHERE id = 'a
b
c';`,
    `a
b
c`
  );
});

t.test("user input is longer than query", async () => {
  isNotSqlInjection(
    `SELECT * FROM users`,
    `SELECT * FROM users WHERE id = 'a'`
  );
});

t.test("It flags multiline queries correctly", async () => {
  isSqlInjection(
    `
        SELECT *
        FROM users
        WHERE id = '1' OR 1=1
      `,
    "1' OR 1=1"
  );
  isSqlInjection(
    `
      SELECT *
      FROM users
      WHERE id = '1' OR 1=1
        AND is_escaped = '1'' OR 1=1'
    `,
    "1' OR 1=1"
  );
  isSqlInjection(
    `
      SELECT *
      FROM users
      WHERE id = '1' OR 1=1
        AND is_escaped = "1' OR 1=1"
    `,
    "1' OR 1=1"
  );

  isNotSqlInjection(
    `
      SELECT * FROM \`users\`
      WHERE id = 123
    `,
    "123"
  );
  isNotSqlInjection(
    `
      SELECT * FROM \`us\`\`ers\`
      WHERE id = 123
    `,
    "users"
  );
  isNotSqlInjection(
    `
        SELECT * FROM users
        WHERE id = 123
    `,
    "123"
  );
  isNotSqlInjection(
    `
        SELECT * FROM users
        WHERE id = '123'
    `,
    "123"
  );
  isNotSqlInjection(
    `
      SELECT *
      FROM users
      WHERE is_escaped = "1' OR 1=1"
    `,
    "1' OR 1=1"
  );
});

t.test("It does not flag key keyword as SQL injection", async () => {
  const query = `
      INSERT INTO businesses (
            business_id,
            created_at,
            updated_at,
            changed_at
          )
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at),
                                  changed_at = VALUES(changed_at)
    `;

  isNotSqlInjection(query, "KEY");
  isNotSqlInjection(query, "VALUES");
  isNotSqlInjection(query, "ON");
  isNotSqlInjection(query, "UPDATE");
  isNotSqlInjection(query, "INSERT");
  isNotSqlInjection(query, "INTO");
  isNotSqlInjection(
    `
    SELECT * FROM users u
    WHERE u.status NOT IN ('active', 'pending')
  `,
    "not in"
  );
});

t.test("It flags function calls as SQL injections", async () => {
  isSqlInjection("SELECT foobar()", "foobar()");
  isSqlInjection("SELECT foobar(1234567)", "foobar(1234567)");
  isSqlInjection("SELECT foobar       ()", "foobar       ()");
  isSqlInjection("SELECT .foobar()", ".foobar()");
  isSqlInjection("SELECT 20+foobar()", "20+foobar()");
  isSqlInjection("SELECT 20-foobar(", "20-foobar(");
  isSqlInjection("SELECT 20<foobar()", "20<foobar()");
  isSqlInjection("SELECT 20*foobar  ()", "20*foobar  ()");
  isSqlInjection("SELECT !foobar()", "!foobar()");
  isSqlInjection("SELECT =foobar()", "=foobar()");
  isSqlInjection("SELECT 1foobar()", "1foobar()");
  isSqlInjection("SELECT 1foo_bar()", "1foo_bar()");
  isSqlInjection("SELECT 1foo-bar()", "1foo-bar()");
  isSqlInjection("SELECT #foobar()", "#foobar()");

  isNotSqlInjection("SELECT 'foobar)'", "foobar)");
  isNotSqlInjection("SELECT 'foobar      )'", "foobar      )");
  isNotSqlInjection("SELECT '€foobar()'", "€foobar()");
});

t.test("It flags lowercased input as SQL injection", async () => {
  isSqlInjection(
    `
      SELECT id,
               email,
               password_hash,
               registered_at,
               is_confirmed,
               first_name,
               last_name
        FROM users WHERE email_lowercase = '' or 1=1 -- a',
    `,
    "' OR 1=1 -- a"
  );
});

t.test("It does not match GROUP keyword", async () => {
  const query = `
      SELECT groups.id AS group_id, group_settings.user_id, group_settings.settings
        FROM groups
        INNER JOIN group_settings ON groups.id = group_settings.group_id AND group_settings.user_id = ?
        WHERE groups.business_id = ?
        GROUP BY group_id
        ORDER BY group_id DESC, group_settings.user_id ASC
    `;

  isNotSqlInjection(query, "group_id");
  isNotSqlInjection(query, "DESC");
  isNotSqlInjection(query, "ASC");
});

t.test("It works with non-UTF-8 characters and emojis", async () => {
  isSqlInjection(
    "SELECT * FROM users WHERE id = 'a \udce9'\nOR 1=1 --'",
    "a \udce9'\nOR 1=1 --"
  );
  isSqlInjection(
    "SELECT * FROM users WHERE id = 'a \uD800'\nOR 1=1 --'",
    "a \uD800'\nOR 1=1 --"
  );
  isSqlInjection(
    "SELECT * FROM users WHERE id = 'a \uDFFF'\nOR 1=1 --'",
    "a \uDFFF'\nOR 1=1 --"
  );
  isSqlInjection(
    "SELECT * FROM users WHERE id = 'a \uDFFF\uDFFF'\nOR 1=1 --'",
    "a \uDFFF\uDFFF'\nOR 1=1 --"
  );
  isSqlInjection(
    "SELECT * FROM users WHERE id = 'a \uDFAB'\nOR 1=1 --'",
    "a \uDFAB'\nOR 1=1 --"
  );
  isSqlInjection(
    "SELECT * FROM users WHERE id = 'a 😀'\nOR 1=1 --'",
    "a 😀'\nOR 1=1 --"
  );
  isSqlInjection(
    "SELECT * FROM users WHERE id = 'a 🛡️'\nOR 1=1 --'",
    "a 🛡️'\nOR 1=1 --"
  );

  isNotSqlInjection("SELECT * FROM users WHERE id = 'a \uD800'", "a \uD800");
  isNotSqlInjection("SELECT * FROM users WHERE id = 'a 🛡️'", "a 🛡️");
});

const files = [
  // Taken from https://github.com/payloadbox/sql-injection-payload-list/tree/master
  join(__dirname, "payloads", "Auth_Bypass.txt"),
  join(__dirname, "payloads", "postgres.txt"),
  join(__dirname, "payloads", "mysql.txt"),
  join(__dirname, "payloads", "mssql_and_db2.txt"),
];

function escapeLikeDatabase(str: string, char: string) {
  // Replace all occurrences of the char with \\char
  // Replace all occurrences of \ with \\
  return (
    char +
    str.replace(
      new RegExp(`${char}|${escapeStringRegexp("\\")}`, "g"),
      "\\" + char
    ) +
    char
  );
}

for (const file of files) {
  const contents = readFileSync(file, "utf-8");
  const lines = contents.split(/\r?\n/);
  for (const sql of lines) {
    t.test(
      `It does not flag ${sql} from ${basename(file)} as SQL injection (when escaped with single quotes using backslash)`,
      async () => {
        const escaped = escapeLikeDatabase(sql, "'");
        t.same(
          detectSQLInjection(
            `SELECT * FROM users WHERE id = ${escaped}`,
            sql,
            new SQLDialectMySQL()
          ),
          0,
          `${sql} (mysql)`
        );
      }
    );

    t.test(
      `It does not flag ${sql} from ${basename(file)} as SQL injection (when escaped with double quotes using backslash)`,
      async () => {
        const escaped = escapeLikeDatabase(sql, '"');
        t.same(
          detectSQLInjection(
            `SELECT * FROM users WHERE id = ${escaped}`,
            sql,
            new SQLDialectMySQL()
          ),
          0,
          `${sql} (mysql)`
        );
      }
    );
  }
}

function isSqlInjection(
  sql: string,
  input: string,
  dialects = [
    new SQLDialectGeneric(),
    new SQLDialectMySQL(),
    new SQLDialectPostgres(),
    new SQLDialectSQLite(),
    new SQLDialectClickHouse(),
  ]
) {
  if (dialects.length === 0) {
    throw new Error("No dialects provided");
  }

  for (const dialect of dialects) {
    t.same(
      detectSQLInjection(sql, input, dialect),
      SQLInjectionDetectionResult.INJECTION_DETECTED,
      `${sql} (${dialect.constructor.name})`
    );
  }
}

function isNotSqlInjection(
  sql: string,
  input: string,
  dialects = [
    new SQLDialectGeneric(),
    new SQLDialectMySQL(),
    new SQLDialectPostgres(),
    new SQLDialectSQLite(),
    new SQLDialectClickHouse(),
  ]
) {
  for (const dialect of dialects) {
    t.same(
      detectSQLInjection(sql, input, dialect),
      SQLInjectionDetectionResult.SAFE,
      `${sql} (${dialect.constructor.name})`
    );
  }
}

function isTokenizeError(
  sql: string,
  input: string,
  dialects = [
    new SQLDialectGeneric(),
    new SQLDialectMySQL(),
    new SQLDialectPostgres(),
    new SQLDialectSQLite(),
    new SQLDialectClickHouse(),
  ]
) {
  for (const dialect of dialects) {
    t.same(
      detectSQLInjection(sql, input, dialect),
      SQLInjectionDetectionResult.FAILED_TO_TOKENIZE,
      `${sql} (${dialect.constructor.name})`
    );
  }
}

t.test("get human readable name", async () => {
  t.same(new SQLDialectGeneric().getHumanReadableName(), "Generic");
  t.same(new SQLDialectMySQL().getHumanReadableName(), "MySQL");
  t.same(new SQLDialectPostgres().getHumanReadableName(), "PostgreSQL");
  t.same(new SQLDialectSQLite().getHumanReadableName(), "SQLite");
  t.same(new SQLDialectClickHouse().getHumanReadableName(), "ClickHouse");
});
