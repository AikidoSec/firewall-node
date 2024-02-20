import * as t from "tap";
import {inputPossibleSql} from "./Postgres";

t.test("Check if SQL commands are flagged", async () => {
    t.ok(inputPossibleSql("Roses are red insErt are blue"));
    t.ok(inputPossibleSql("Roses are red cREATE are blue"));
    t.ok(inputPossibleSql("Roses are red drop are blue"));
    t.ok(inputPossibleSql("Roses are red updatE are blue"));
    t.ok(inputPossibleSql("Roses are red SELECT are blue"));
    t.ok(inputPossibleSql("Roses are red dataBASE are blue"));
    t.notOk(inputPossibleSql("Roses are reddelete are blue"));
    t.ok(inputPossibleSql("Roses are red alter are blue"));
    t.ok(inputPossibleSql("Roses are red grant are blue"));
    t.ok(inputPossibleSql("Roses are red savepoint are blue"));
    t.ok(inputPossibleSql("Roses are red commit are blue"));
    t.notOk(inputPossibleSql("Roses are red rollbacks are blue"));
    t.notOk(inputPossibleSql("Roses are red truncates are blue"));

    t.notOk(inputPossibleSql("Roses are red WHEREis blue"));
    t.notOk(inputPossibleSql("Roses are redFROM is blue"));
    t.notOk(inputPossibleSql("Roses are red ORis isAND"));
});

// https://github.com/payloadbox/sql-injection-payload-list/blob/master/Intruder/payloads-sql-blind/MSSQL/payloads-sql-blind-MSSQL-INSERT.txt
t.test("Check for statements from MSSQL-INSERT.txt", async () => {
    t.ok(inputPossibleSql(`"),NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)%20waitfor%20delay%20'0:0:20'%20--`));
    t.ok(inputPossibleSql(`',NULL,NULL,NULL,NULL,NULL,NULL)%20waitfor%20delay%20'0:0:20'%20--`));
    t.ok(inputPossibleSql(`',NULL,NULL,NULL,NULL,NULL)%20waitfor%20delay%20'0:0:20'%20--`));
    t.ok(inputPossibleSql(`)%20waitfor%20delay%20'0:0:20'%20/*`));
    t.ok(inputPossibleSql(`))%20waitfor%20delay%20'0:0:20'%20--`));
});

// https://github.com/payloadbox/sql-injection-payload-list/blob/master/Intruder/detect/MySQL/MySQL.txt
t.test("Check for statements from MySQL.txt", async() => {
    t.ok(inputPossibleSql(`1'1`));
    t.ok(inputPossibleSql(`1 exec sp_ (or exec xp_)`));
    t.ok(inputPossibleSql(`1 and 1=1`));
    t.ok(inputPossibleSql(`1' and 1=(select count(*) from tablenames); --`));
    t.ok(inputPossibleSql(`1 or 1=1`));
    t.ok(inputPossibleSql(`1or1=1`));
    t.ok(inputPossibleSql(`fake@ema'or'il.nl'='il.nl`));
    t.ok(inputPossibleSql(`1'or'1'='1`));
})

// https://github.com/payloadbox/sql-injection-payload-list/blob/master/Intruder/exploit/Auth_Bypass.txt
t.test("Check for statements from Auth_Bypass.txt", async () => {
    t.ok(inputPossibleSql(`'-'`));
    t.ok(inputPossibleSql(`")) or (("x"))=(("x`));
    t.ok(inputPossibleSql(`admin' or '1'='1'#`));
    t.ok(inputPossibleSql(`' AND 1=0 UNION ALL SELECT '', '81dc9bdb52d04dc20036dbd8313ed055`));
    t.ok(inputPossibleSql(`') or ('a'='a and hi") or ("a"="a`));
    t.ok(inputPossibleSql(`" or "1"="1`));
    t.ok(inputPossibleSql(`' UNION ALL SELECT system_user(),user();#`));
    t.ok(inputPossibleSql(`admin' and substring(password/text(),1,1)='7`));
    t.ok(inputPossibleSql(`' or 1=1 limit 1 -- -+`));
    t.ok(inputPossibleSql(` or 1=1–`));
    t.ok(inputPossibleSql(` or 1=1`));
});

t.test("Check for some statements that are allowed", async () => {
    t.notOk(inputPossibleSql(`abcdefghijklmnop@hotmail.com`));
    t.notOk(inputPossibleSql(`roses are red violets are blue!`));
    t.notOk(inputPossibleSql(`1 is cool 2 is nice 3 thats thrice.`));
});