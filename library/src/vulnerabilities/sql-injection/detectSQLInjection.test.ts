import { basename, join } from "path";
import * as t from "tap";
import { readFileSync } from "fs";
import { dangerousCharsInInput } from "./dangerousCharsInInput";
import { detectSQLInjection } from "./detectSQLInjection";
import { queryContainsUserInput } from "./queryContainsUserInput";
import { userInputOccurrencesSafelyEncapsulated } from "./userInputOccurrencesSafelyEncapsulated";

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
];

const IS_INJECTION = [
  [`'union'  is not UNION`, "UNION"], // String not always encapsulated
  [`'union'  is not "UNION--"`, "UNION--"], // String encapsulated but dangerous chars
  [`"COPY/*"`, "COPY/*"], // String encapsulated but dangerous chars
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

t.test(
  "Test the detectSQLInjection() function to see if it detects SQL Functions",
  async () => {
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
    isNotSqlInjection("$foobar()", "$foobar()");
  }
);

t.test("It flags postgres bitwise operator as SQL injection", async () => {
  isSqlInjection("SELECT 10 # 12", "10 # 12");
});

t.test("It flags MySQL bitwise operator as SQL injection", async () => {
  isSqlInjection("SELECT 10 ^ 12", "10 ^ 12");
});

t.test("It flags postgres type cast operator as SQL injection", async () => {
  isSqlInjection("SELECT abc::date", "abc::date");
});

function isSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input), true, sql);
}

function isNotSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input), false, sql);
}

const files = [
  // Taken from https://github.com/payloadbox/sql-injection-payload-list/tree/master
  join(__dirname, "payloads", "Auth_Bypass.txt"),
  join(__dirname, "payloads", "postgres.txt"),
  join(__dirname, "payloads", "mysql.txt"),
  join(__dirname, "payloads", "mssql_and_db2.txt"),
];

function quote(str: string) {
  return `'${str.replace(/'/g, "''")}'`;
}

for (const file of files) {
  const contents = readFileSync(file, "utf-8");
  const lines = contents.split(/\r?\n/);
  for (const sql of lines) {
    t.test(
      `It flags ${sql} from ${basename(file)} as SQL injection`,
      async () => {
        t.same(detectSQLInjection(sql, sql), true, sql);
      }
    );

    t.test(
      `It does not flag ${sql} from ${basename(file)} as SQL injection (when escaped)`,
      async () => {
        const escaped = quote(sql);
        t.same(
          detectSQLInjection("SELECT * FROM users WHERE id = ${escaped}", sql),
          false,
          sql
        );
      }
    );
  }
}
