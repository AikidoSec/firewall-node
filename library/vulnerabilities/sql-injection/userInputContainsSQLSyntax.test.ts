import * as t from "tap";
import { SQLDialectMySQL } from "./dialects/SQLDialectMySQL";
import { userInputContainsSQLSyntax } from "./userInputContainsSQLSyntax";

t.test("it flags dialect specific keywords", async () => {
  t.same(userInputContainsSQLSyntax("@@GLOBAL", new SQLDialectMySQL()), true);
});

t.test("it does not flag common SQL keywords", async () => {
  t.same(userInputContainsSQLSyntax("SELECT", new SQLDialectMySQL()), false);
});
