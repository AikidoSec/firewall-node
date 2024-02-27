import * as t from "tap";
import * as fs from "fs";
import * as path from "path";
import { dangerousCharsInInput } from "./dangerousCharsInInput";
import {
  detectSQLInjection,
  userInputOccurrencesSafelyEncapsulated,
  queryContainsUserInput,
} from "./detectSQLInjection";

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
  `roses are red violets are blue#`,
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

// BEGIN TESTS WITH EXPLOITS FROM : https://github.com/payloadbox/sql-injection-payload-list/tree/master

const AUTH_BYPASS = fs
  .readFileSync(
    path.join(
      __dirname,
      "./../../../testing/sql-injection-payloads/Auth_Bypass.txt"
    ),
    "utf-8"
  )
  .split(/\r?\n/);

t.test("Test the detectSQLInjection() with Auth_Bypass.txt", async () => {
  for (const sql of AUTH_BYPASS) {
    isSqlInjection(sql, sql);
  }
});

const POSTGRES_TXT = fs
  .readFileSync(
    path.join(
      __dirname,
      "./../../../testing/sql-injection-payloads/postgres.txt"
    ),
    "utf-8"
  )
  .split(/\r?\n/);

t.test("Test the detectSQLInjection() with postgres.txt", async () => {
  for (const sql of POSTGRES_TXT) {
    isSqlInjection(sql, sql);
  }
});

const MYSQL_TXT = fs
  .readFileSync(
    path.join(__dirname, "./../../../testing/sql-injection-payloads/mysql.txt"),
    "utf-8"
  )
  .split(/\r?\n/);

t.test(
  "Test the detectSQLInjection() with postgres-enumeration.txt",
  async () => {
    for (const sql of MYSQL_TXT) {
      isSqlInjection(sql, sql);
    }
  }
);

const MSSQL_AND_DB2 = fs
  .readFileSync(
    path.join(
      __dirname,
      "./../../../testing/sql-injection-payloads/mssql_and_db2.txt"
    ),
    "utf-8"
  )
  .split(/\r?\n/);

t.test("Test the detectSQLInjection() with mssql_and_db2.txt", async () => {
  for (const sql of MSSQL_AND_DB2) {
    isSqlInjection(sql, sql);
  }
});

// END TESTS WITH EXPLOITS FROM : https://github.com/payloadbox/sql-injection-payload-list/tree/master

t.test(
  "Test the detectSQLInjection() function to see if it detects SQL Functions",
  async () => {
    // Keep in mind t.ok means that it IS in fact a SQL Injection
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

    isNotSqlInjection("foobar)", "foobar)");
    isNotSqlInjection("foobar      )", "foobar      )");
    isNotSqlInjection("#foobar()", "#foobar()");
    isNotSqlInjection("$foobar()", "$foobar()");
  }
);

t.test("Test the queryContainsUserInput() function", async () => {
  t.ok(queryContainsUserInput("SELECT * FROM 'Jonas';", "Jonas"));
  t.ok(queryContainsUserInput("Hi I'm MJoNaSs", "jonas"));
  t.ok(queryContainsUserInput("Hiya, 123^&*( is a real string", "123^&*("));
  t.notOk(queryContainsUserInput("Roses are red", "violet"));
});

t.test(
  "Test the userInputOccurrencesSafelyEncapsulated() function",
  async () => {
    t.ok(
      userInputOccurrencesSafelyEncapsulated(
        ` Hello Hello 'UNION'and also "UNION" `,
        "UNION"
      )
    );
    t.ok(userInputOccurrencesSafelyEncapsulated(`"UNION"`, "UNION"));
    t.ok(userInputOccurrencesSafelyEncapsulated(` 'UNION' `, "UNION"));
    t.ok(userInputOccurrencesSafelyEncapsulated(`"UNION"'UNION'`, "UNION"));

    t.notOk(
      userInputOccurrencesSafelyEncapsulated(`'UNION'"UNION"UNION`, "UNION")
    );
    t.notOk(
      userInputOccurrencesSafelyEncapsulated(`'UNION'UNION"UNION"`, "UNION")
    );
    t.notOk(userInputOccurrencesSafelyEncapsulated("UNION", "UNION"));
  }
);

t.test("Test the dangerousCharsInInput() function", async () => {
  t.ok(dangerousCharsInInput("This is not ok--"));
});

function isSqlInjection(sql: string, input: string) {
  t.ok(detectSQLInjection(sql, input), sql);
}

function isNotSqlInjection(sql: string, input: string) {
  t.notOk(detectSQLInjection(sql, input), sql);
}
