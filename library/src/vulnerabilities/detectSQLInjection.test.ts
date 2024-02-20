import * as t from "tap";
import {
  detectSQLInjection,
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
  // https://github.com/payloadbox/sql-injection-payload-list/blob/master/Intruder/payloads-sql-blind/MSSQL/payloads-sql-blind-MSSQL-INSERT.txt
  `"),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)%20waitfor%20delay%20'0:0:20'%20--`,
  `',NULL,NULL,NULL,NULL,NULL,NULL)%20waitfor%20delay%20'0:0:20'%20--`,
  `',NULL,NULL,NULL,NULL,NULL)%20waitfor%20delay%20'0:0:20'%20--`,
  `)%20waitfor%20delay%20'0:0:20'%20/*`,
  `))%20waitfor%20delay%20'0:0:20'%20--`,
  // https://github.com/payloadbox/sql-injection-payload-list/blob/master/Intruder/detect/MySQL/MySQL.txt
  `1'1`,
  `1 exec sp_ (or exec xp_)`,
  `1 and 1=1`,
  `1' and 1=(select count(*) from tablenames); --`,
  `1 or 1=1`,
  `1or1=1`,
  `fake@ema'or'il.nl'='il.nl`,
  `1'or'1'='1`,
  // https://github.com/payloadbox/sql-injection-payload-list/blob/master/Intruder/exploit/Auth_Bypass.txt
  `'-'`,
  `")) or (("x"))=(("x`,
  `admin' or '1'='1'#`,
  `' AND 1=0 UNION ALL SELECT '', '81dc9bdb52d04dc20036dbd8313ed055`,
  `') or ('a'='a and hi") or ("a"="a`,
  `" or "1"="1`,
  `' UNION ALL SELECT system_user(),user();#`,
  `admin' and substring(password/text(),1,1)='7`,
  `' or 1=1 limit 1 -- -+`,
  ` or 1=1–`,
  ` or 1=1`,
  // Test some special characters
  "I'm writting you",
  "This is not ok--",
  "Termin;ate",
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
  `roses are red violets are blue!`,
  `1 is cool 2 is nice 3 thats thrice.`,
  // Test some special characters
  "steve@yahoo.com",
];

const IS_NOT_INJECTION = [
  [`'UNION 123' UNION "UNION 123" `, "UNION 123"],
];

const IS_INJECTION = [
  [`'union'  is not UNION`, "UNION"],
];

t.test("Test the inputPossibleSql() function", async () => {
  for (const sql of BAD_SQL_COMMANDS) {
    t.ok(inputPossibleSql(sql), sql);
  }
  for (const sql of GOOD_SQL_COMMANDS) {
    t.notOk(inputPossibleSql(sql), sql);
  }
});

t.test("Test the sqlContainsInput() function", async () => {
  t.ok(sqlContainsInput("SELECT * FROM 'Jonas';", "Jonas"));
  t.ok(sqlContainsInput("Hi I'm MJoNaSs", "jonas"));
  t.ok(sqlContainsInput("Hiya, 123^&*( is a real string", "123^&*("));
  t.notOk(sqlContainsInput("Roses are red", "violet"));
});
t.test("Test detectSQLInjection() function", async () => {
  for (const test of IS_INJECTION) {
    t.ok(detectSQLInjection(test[0], test[1]), test[0]);
  }
  for (const test of IS_NOT_INJECTION) {
    t.notOk(detectSQLInjection(test[0], test[1]), test[0]);
  }
});
