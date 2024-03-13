/* eslint-disable max-lines-per-function */
import { SQLDialect } from "./SQLDialect";

export class SQLDialectMySQL implements SQLDialect {
  //https://dev.mysql.com/doc/refman/8.0/en/keywords.html
  getKeywords(): string[] {
    return [];
  }
}
