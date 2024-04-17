import { basename, join } from "path";
import * as t from "tap";
import { readFileSync } from "fs";
import { SQL_DANGEROUS_IN_STRING } from "./config";
import { detectSQLInjection } from "./detectSQLInjection";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";
import { SQLDialectPostgres } from "./dialects/SQLDialectPostgres";

const BAD_SQL_COMMANDS = [
  // Check for SQL Commands like : INSERT or DROP
  "Roses are red insErt are blue",
  "Roses are red cREATE are blue",
  "Roses are red drop are blue",
  "Roses are red updatE are blue",
  "Roses are red SELECT are blue",
  "Roses are red dataBASE are blue",
  "Roses are red alter are blue",
  "Roses are red grant are blue",
  "Roses are red savepoint are blue",
  "Roses are red commit are blue",
  "Roses are red or blue",
  "Roses are red and lovely",
  "This is a group_concat_test",
  // Test some special characters
  "I'm writting you",
  "Termin;ate",
  "Roses <> violets",
  "Roses < Violets",
  "Roses > Violets",
  "Roses != Violets",
];

const GOOD_SQL_COMMANDS = [
  // Check for SQL Commands with allowed characters
  "Roses are red rollbacks are blue",
  "Roses are red truncates are blue",
  "Roses are reddelete are blue",
  "Roses are red WHEREis blue",
  "Roses are red ORis isAND",
  // Check for some general statements
  `abcdefghijklmnop@hotmail.com`,
  // Test some special characters
  "steve@yahoo.com",
  // Test SQL Function (that should not be blocked)
  "I was benchmark ing",
  "We were delay ed",
  "I will waitfor you",
  // Allow single characters
  "#",
  "'",
];

const IS_NOT_INJECTION = [
  [`'UNION 123' UNION "UNION 123"`, "UNION 123"], // String encapsulation
  [`'union'  is not "UNION"`, "UNION!"], // String not present in SQL
  [`"UNION;"`, "UNION;"], // String encapsulation
  ["SELECT * FROM table", "*"],
  [`"COPY/*"`, "COPY/*"], // String encapsulated but dangerous chars
  [`'union'  is not "UNION--"`, "UNION--"], // String encapsulated but dangerous chars
];

const IS_INJECTION = [
  [`'union'  is not UNION`, "UNION"], // String not always encapsulated
  [`UNTER;`, "UNTER;"], // String not encapsulated and dangerous char (;)
];

t.test("Test the detectSQLInjection() function", async () => {
  for (const sql of BAD_SQL_COMMANDS) {
    isSqlInjection(sql, sql);
  }
  for (const sql of GOOD_SQL_COMMANDS) {
    isNotSqlInjection(sql, sql);
  }
});

t.test("Test detectSQLInjection() function", async () => {
  for (const test of IS_INJECTION) {
    isSqlInjection(test[0], test[1]);
  }
  for (const test of IS_NOT_INJECTION) {
    isNotSqlInjection(test[0], test[1]);
  }
});

t.test("It allows escape sequences", async () => {
  isSqlInjection("SELECT * FROM users WHERE id = 'users\\'", "users\\");
  isSqlInjection("SELECT * FROM users WHERE id = 'users\\\\'", "users\\\\");

  isNotSqlInjection("SELECT * FROM users WHERE id = '\nusers'", "\nusers");
  isNotSqlInjection("SELECT * FROM users WHERE id = '\rusers'", "\rusers");
  isNotSqlInjection("SELECT * FROM users WHERE id = '\tusers'", "\tusers");
});

t.test("user input inside IN (...)", async () => {
  isSqlInjection("SELECT * FROM users WHERE id IN ('123')", "'123'");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (123)", "123");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (123, 456)", "123");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (123, 456)", "456");
  isNotSqlInjection("SELECT * FROM users WHERE id IN ('123')", "123");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (13,14,15)", "13,14,15");
  isNotSqlInjection("SELECT * FROM users WHERE id IN (13, 14, 154)", "13, 14, 154");
});

t.test("It checks whether the string is safely escaped", async () => {
  isSqlInjection(
    `SELECT * FROM comments WHERE comment = 'I'm writting you'`,
    "I'm writting you"
  );
  isSqlInjection(
    `SELECT * FROM comments WHERE comment = "I"m writting you"`,
    'I"m writting you'
  );
  isSqlInjection("SELECT * FROM `comm`ents`", "`comm`ents");

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
  isNotSqlInjection("SELECT * FROM `comm'ents`", "comm'ents");
});

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
OR 1=1#`
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
      SELECT * FROM \`users\`\`
      WHERE id = 123
    `,
    "users`"
  );
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

SQL_DANGEROUS_IN_STRING.forEach((dangerous) => {
  t.test(
    `It flags dangerous string ${dangerous} as SQL injection`,
    async () => {
      // Needs to be longer than 1 char
      const input = `${dangerous} a`;
      isSqlInjection(`SELECT * FROM users WHERE ${input}`, input);
    }
  );
});

t.test("It flags function calls as SQL injections", async () => {
  isSqlInjection("foobar()", "foobar()");
  isSqlInjection("foobar(1234567)", "foobar(1234567)");
  isSqlInjection("foobar       ()", "foobar       ()");
  isSqlInjection(".foobar()", ".foobar()");
  isSqlInjection("20+foobar()", "20+foobar()");
  isSqlInjection("20-foobar(", "20-foobar(");
  isSqlInjection("20<foobar()", "20<foobar()");
  isSqlInjection("20*foobar  ()", "20*foobar  ()");
  isSqlInjection("!foobar()", "!foobar()");
  isSqlInjection("=foobar()", "=foobar()");
  isSqlInjection("1foobar()", "1foobar()");
  isSqlInjection("1foo_bar()", "1foo_bar()");
  isSqlInjection("1foo-bar()", "1foo-bar()");
  isSqlInjection("#foobar()", "#foobar()");

  isNotSqlInjection("foobar)", "foobar)");
  isNotSqlInjection("foobar      )", "foobar      )");
  isNotSqlInjection("€foobar()", "€foobar()");
});

const files = [
  // Taken from https://github.com/payloadbox/sql-injection-payload-list/tree/master
  join(__dirname, "payloads", "Auth_Bypass.txt"),
  join(__dirname, "payloads", "postgres.txt"),
  join(__dirname, "payloads", "mysql.txt"),
  join(__dirname, "payloads", "mssql_and_db2.txt"),
];

/**
 * escapeLikeDatabase("I'm a test", "'") => 'I''m a test'
 * escapeLikeDatabase("I'm a test", "'", true) => 'I\'m a test'
 */
function escapeLikeDatabase(str: string, char: string, backslash = false) {
  return (
    char +
    str.replace(
      new RegExp(char, "g"),
      backslash ? "\\" + char : char.repeat(2)
    ) +
    char
  );
}

for (const file of files) {
  const contents = readFileSync(file, "utf-8");
  const lines = contents.split(/\r?\n/);
  for (const sql of lines) {
    t.test(
      `It flags ${sql} from ${basename(file)} as SQL injection`,
      async () => {
        isSqlInjection(sql, sql);
      }
    );

    t.test(
      `It flags ${sql} from ${basename(file)} as SQL injection (in query)`,
      async () => {
        isSqlInjection(`SELECT * FROM users ${sql}`, sql);
      }
    );

    t.test(
      `It does not flag ${sql} from ${basename(file)} as SQL injection (when escaped with single quotes)`,
      async () => {
        const escaped = escapeLikeDatabase(sql, "'");
        isNotSqlInjection("SELECT * FROM users WHERE id = ${escaped}", sql);
      }
    );

    t.test(
      `It does not flag ${sql} from ${basename(file)} as SQL injection (when escaped with single quotes using backslash)`,
      async () => {
        const escaped = escapeLikeDatabase(sql, "'", true);
        isNotSqlInjection("SELECT * FROM users WHERE id = ${escaped}", sql);
      }
    );

    t.test(
      `It does not flag ${sql} from ${basename(file)} as SQL injection (when escaped with double quotes)`,
      async () => {
        const escaped = escapeLikeDatabase(sql, '"');
        isNotSqlInjection("SELECT * FROM users WHERE id = ${escaped}", sql);
      }
    );

    t.test(
      `It does not flag ${sql} from ${basename(file)} as SQL injection (when escaped with double quotes using backslash)`,
      async () => {
        const escaped = escapeLikeDatabase(sql, '"', true);
        isNotSqlInjection("SELECT * FROM users WHERE id = ${escaped}", sql);
      }
    );

    t.test(
      `It does not flag ${sql} from ${basename(file)} as SQL injection (when escaped with backticks)`,
      async () => {
        const escaped = escapeLikeDatabase(sql, "`");
        isNotSqlInjection("SELECT * FROM ${escaped}", sql);
      }
    );
  }
}

function isSqlInjection(sql: string, input: string) {
  t.same(
    detectSQLInjection(sql, input, new SQLDialectMySQL()),
    true,
    `${sql} (mysql)`
  );
  t.same(
    detectSQLInjection(sql, input, new SQLDialectPostgres()),
    true,
    `${sql} (postgres)`
  );
}

function isNotSqlInjection(sql: string, input: string) {
  t.same(
    detectSQLInjection(sql, input, new SQLDialectMySQL()),
    false,
    `${sql} (mysql)`
  );
  t.same(
    detectSQLInjection(sql, input, new SQLDialectPostgres()),
    false,
    `${sql} (postgres)`
  );
}
