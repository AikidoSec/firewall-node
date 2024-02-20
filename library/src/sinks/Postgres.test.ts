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
})