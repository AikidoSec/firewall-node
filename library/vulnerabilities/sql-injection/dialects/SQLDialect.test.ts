import t from "tap";
import { SQLDialectMySQL } from "./SQLDialectMySQL";
import { SQLDialectPostgres } from "./SQLDialectPostgres";

const dialects = [new SQLDialectMySQL(), new SQLDialectPostgres()];

dialects.forEach((dialect) => {
  t.test(
    `it returns a unique list of dangerous strings for ${dialect.constructor.name}`,
    async () => {
      const keywords = dialect.getDangerousStrings();
      const dangerousStrings = new Set(keywords);
      t.equal(keywords.length, dangerousStrings.size);
    }
  );

  t.test(
    "no empty strings in the list of dangerous strings for ${dialect.constructor.name}",
    async () => {
      const dangerousStrings = dialect.getDangerousStrings();
      dangerousStrings.forEach((keyword) => {
        t.ok(keyword.length > 0);
      });
    }
  );
});
