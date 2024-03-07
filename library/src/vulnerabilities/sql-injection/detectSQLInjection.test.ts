import { basename, join } from "path";
import * as t from "tap";
import { readFileSync } from "fs";
import { dangerousCharsInInput } from "./dangerousCharsInInput";
import {
  detectSQLInjection,
  userInputOccurrencesSafelyEncapsulated,
  queryContainsUserInput,
} from "./detectSQLInjection";
import { SQLDialectMySQL } from "./dialect/SQLDialectMySQL";

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

// END TESTS WITH EXPLOITS FROM : https://github.com/payloadbox/sql-injection-payload-list/tree/master

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

t.test("Test the queryContainsUserInput() function", async () => {
  t.same(queryContainsUserInput("SELECT * FROM 'Jonas';", "Jonas"), true);
  t.same(queryContainsUserInput("Hi I'm MJoNaSs", "jonas"), true);
  t.same(
    queryContainsUserInput("Hiya, 123^&*( is a real string", "123^&*("),
    true
  );
  t.same(queryContainsUserInput("Roses are red", "violet"), false);
});

t.test(
  "Test the userInputOccurrencesSafelyEncapsulated() function",
  async () => {
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        ` Hello Hello 'UNION'and also "UNION" `,
        "UNION",
        new SQLDialectMySQL()
      ),
      true
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `"UNION"`,
        "UNION",
        new SQLDialectMySQL()
      ),
      true
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        ` 'UNION' `,
        "UNION",
        new SQLDialectMySQL()
      ),
      true
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `"UNION"'UNION'`,
        "UNION",
        new SQLDialectMySQL()
      ),
      true
    );

    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `'UNION'"UNION"UNION`,
        "UNION",
        new SQLDialectMySQL()
      ),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        `'UNION'UNION"UNION"`,
        "UNION",
        new SQLDialectMySQL()
      ),
      false
    );
    t.same(
      userInputOccurrencesSafelyEncapsulated(
        "UNION",
        "UNION",
        new SQLDialectMySQL()
      ),
      false
    );
  }
);

t.test("Test the dangerousCharsInInput() function", async () => {
  t.ok(dangerousCharsInInput("This is not ok--"));
});

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
  t.same(detectSQLInjection(sql, input, new SQLDialectMySQL()), true, sql);
}

function isNotSqlInjection(sql: string, input: string) {
  t.same(detectSQLInjection(sql, input, new SQLDialectMySQL()), false, sql);
}

const files = [
  // Taken from https://github.com/payloadbox/sql-injection-payload-list/tree/master
  join(__dirname, "payloads", "Auth_Bypass.txt"),
  join(__dirname, "payloads", "postgres.txt"),
  join(__dirname, "payloads", "mysql.txt"),
];

for (const file of files) {
  const contents = readFileSync(file, "utf-8");
  const lines = contents.split(/\r?\n/);
  for (const sql of lines) {
    const source = `${sql} (${basename(file)})`;
    t.test(
      `It flags ${sql} from ${basename(file)} as SQL injection`,
      async () => {
        t.same(
          detectSQLInjection(sql, sql, new SQLDialectMySQL()),
          true,
          source
        );
      }
    );
  }
}
