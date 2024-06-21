/* eslint-disable max-lines-per-function */
import { SQLDialect } from "./SQLDialect";

export class SQLDialectSQLite implements SQLDialect {
  getDangerousStrings(): string[] {
    return [];
  }

  getKeywords(): string[] {
    return [
      // Todo
    ];
  }
}
