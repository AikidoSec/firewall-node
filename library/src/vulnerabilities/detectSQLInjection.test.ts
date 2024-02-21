import * as t from "tap";
import * as fs from "fs";
import * as path from "path";
import {
  dangerousCharsInInput,
  detectSQLInjection,
  inputAlwaysEncapsulated,
  inputPossibleSql,
  sqlContainsInput,
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
];
const GOOD_SQL_COMMANDS = [
  // Check for SQL Commands with allowed characters
  "Roses are red rollbacks are blue",
  "Roses are red truncates are blue",
  "Roses are reddelete are blue",
  "Roses are red WHEREis blue",
  "Roses are redFROM is blue",
  "Roses are red ORis isAND",
  // Check for some general statements
  `abcdefghijklmnop@hotmail.com`,
  `roses are red violets are blue#`,
  `1 is cool 2 is nice 3 thats thrice.`,
  // Test some special characters
  "steve@yahoo.com",
  // Test SQL Function (that should not be blocked)
  "I was benchmark ing",
  "We were delay ed",
  "I will waitfor you",
];

const IS_NOT_INJECTION = [
  [`'UNION 123' UNION "UNION 123"`, "UNION 123"],
  [`'union'  is not "UNION"`, "UNION!"],
  [`"UNION;"`, "UNION;"],
];

const IS_INJECTION = [
  [`'union'  is not UNION`, "UNION"],
  [`'union'  is not "UNION--"`, "UNION--"],
  [`"COPY/*"`, "COPY/*"],
  [`UNTER;`, "UNTER;"],
];

t.test("Test the detectSQLInjection() function", async () => {
  for (const sql of BAD_SQL_COMMANDS) {
    t.ok(detectSQLInjection(sql, sql), sql);
  }
  for (const sql of GOOD_SQL_COMMANDS) {
    t.notOk(detectSQLInjection(sql, sql), sql);
  }
});
t.test("Test detectSQLInjection() function", async () => {
  for (const test of IS_INJECTION) {
    t.ok(detectSQLInjection(test[0], test[1]), test[0]);
  }
  for (const test of IS_NOT_INJECTION) {
    t.notOk(detectSQLInjection(test[0], test[1]), test[0]);
  }
});

// BEGIN TESTS WITH EXPLOITS FROM : https://github.com/payloadbox/sql-injection-payload-list/tree/master

const auth_bypass = fs
  .readFileSync(
    path.join(__dirname, "./../../testing/exploit/Auth_Bypass.txt"),
    "utf-8"
  )
  .split(/\r?\n/);
t.test("Test the detectSQLInjection() with Auth_Bypass.txt", async () => {
  for (const sql of auth_bypass) {
    t.ok(detectSQLInjection(sql, sql), sql);
  }
});

const postgres_txt = fs
  .readFileSync(
    path.join(__dirname, "./../../testing/exploit/postgres.txt"),
    "utf-8"
  )
  .split(/\r?\n/);
t.test("Test the detectSQLInjection() with postgres.txt", async () => {
  for (const sql of postgres_txt) {
    t.ok(detectSQLInjection(sql, sql), sql);
  }
});

const mysql_txt = fs
  .readFileSync(
    path.join(__dirname, "./../../testing/exploit/mysql.txt"),
    "utf-8"
  )
  .split(/\r?\n/);
t.test(
  "Test the detectSQLInjection() with postgres-enumeration.txt",
  async () => {
    for (const sql of mysql_txt) {
      t.ok(detectSQLInjection(sql, sql), sql);
    }
  }
);

const mssql_and_db2_txt = fs
  .readFileSync(
    path.join(__dirname, "./../../testing/exploit/mssql_and_db2.txt"),
    "utf-8"
  )
  .split(/\r?\n/);
t.test("Test the detectSQLInjection() with mssql_and_db2.txt", async () => {
  for (const sql of mysql_txt) {
    t.ok(detectSQLInjection(sql, sql), sql);
  }
});

// END TESTS WITH EXPLOITS FROM : https://github.com/payloadbox/sql-injection-payload-list/tree/master

t.test(
  "Test the detectSQLInjection() function to see if it detects SQL Functions",
  async () => {
    // Keep in mind t.ok means that it IS in fact a SQL Injection
    t.ok(detectSQLInjection("foobar()", "foobar()"));
    t.ok(detectSQLInjection("foobar(1234567)", "foobar(1234567)"));
    t.ok(detectSQLInjection("foobar       ()", "foobar       ()"));
    t.ok(detectSQLInjection(".foobar()", ".foobar()"));
    t.ok(detectSQLInjection("20+foobar()", "20+foobar()"));
    t.ok(detectSQLInjection("20-foobar(", "20-foobar("));
    t.ok(detectSQLInjection("20<foobar()", "20<foobar()"));
    t.ok(detectSQLInjection("20*foobar  ()", "20*foobar  ()"));
    t.ok(detectSQLInjection("!foobar()", "!foobar()"));
    t.ok(detectSQLInjection("=foobar()", "=foobar()"));

    t.notOk(detectSQLInjection("foobar)", "foobar)"));
    t.notOk(detectSQLInjection("foobar      )", "foobar      )"));
    t.notOk(detectSQLInjection("1foobar()", "1foobar()"));
    t.notOk(detectSQLInjection("#foobar()", "#foobar()"));
    t.notOk(detectSQLInjection("$foobar()", "$foobar()"));
  }
);

t.test("Test the sqlContainsInput() function", async () => {
  t.ok(sqlContainsInput("SELECT * FROM 'Jonas';", "Jonas"));
  t.ok(sqlContainsInput("Hi I'm MJoNaSs", "jonas"));
  t.ok(sqlContainsInput("Hiya, 123^&*( is a real string", "123^&*("));
  t.notOk(sqlContainsInput("Roses are red", "violet"));
});

t.test("Test the inputAlwaysEncapsulated() function", async () => {
  t.ok(
    inputAlwaysEncapsulated(` Hello Hello 'UNION'and also "UNION" `, "UNION")
  );
  t.ok(inputAlwaysEncapsulated(`"UNION"`, "UNION"));
  t.ok(inputAlwaysEncapsulated(` 'UNION' `, "UNION"));
  t.ok(inputAlwaysEncapsulated(`"UNION"'UNION'`, "UNION"));

  t.notOk(inputAlwaysEncapsulated(`'UNION'"UNION"UNION`, "UNION"));
  t.notOk(inputAlwaysEncapsulated(`'UNION'UNION"UNION"`, "UNION"));
  t.notOk(inputAlwaysEncapsulated("UNION", "UNION"));
});

t.test("Test the dangerousCharsInInput() function", async () => {
  t.ok(dangerousCharsInInput("This is not ok--"));
});
