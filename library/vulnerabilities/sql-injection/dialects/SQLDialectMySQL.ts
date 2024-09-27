/* eslint-disable max-lines-per-function */
import { SQLDialect } from "./SQLDialect";

export class SQLDialectMySQL implements SQLDialect {
  getDangerousStrings(): string[] {
    return [];
  }

  getKeywords(): string[] {
    return [
      // https://dev.mysql.com/doc/refman/8.0/en/set-variable.html
      "GLOBAL",
      "SESSION",
      "PERSIST",
      "PERSIST_ONLY",
      "@@GLOBAL",
      "@@SESSION",

      // https://dev.mysql.com/doc/refman/8.0/en/set-character-set.html
      "CHARACTER SET",
      "CHARSET",
    ];
  }

  getWASMDialectInt(): number {
    return 8;
  }
}
