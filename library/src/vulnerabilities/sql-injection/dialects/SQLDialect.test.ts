import * as t from "tap";
import { SQLDialectMySQL } from "./SQLDialectMySQL";
import { SQLDialectPostgres } from "./SQLDialectPostgres";

const dialects = [new SQLDialectMySQL(), new SQLDialectPostgres()];

dialects.forEach((dialect) => {
  t.test(
    `it returns a unique list of keywords for ${dialect.constructor.name}`,
    async () => {
      const keywords = dialect.getKeywords();
      const uniqueKeywords = new Set(keywords);
      t.equal(keywords.length, uniqueKeywords.size);
    }
  );

  t.test(
    "no empty strings in the list of keywords for ${dialect.constructor.name}",
    async () => {
      const keywords = dialect.getKeywords();
      keywords.forEach((keyword) => {
        t.ok(keyword.length > 0);
      });
    }
  );
});
