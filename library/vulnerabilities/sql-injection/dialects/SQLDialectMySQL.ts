/* eslint-disable max-lines-per-function */
import { SQLDialect } from "./SQLDialect";

export class SQLDialectMySQL implements SQLDialect {
  getDangerousStrings(): string[] {
    return [];
  }

  getKeywords(): { keyword: string; ignoreExact: boolean }[] {
    return [
      // https://dev.mysql.com/doc/refman/8.0/en/set-variable.html
      { keyword: "GLOBAL", ignoreExact: false },
      { keyword: "SESSION", ignoreExact: false },
      { keyword: "PERSIST", ignoreExact: false },
      { keyword: "PERSIST_ONLY", ignoreExact: false },
      { keyword: "@@GLOBAL", ignoreExact: false },
      { keyword: "@@SESSION", ignoreExact: false },

      // https://dev.mysql.com/doc/refman/8.0/en/set-character-set.html
      { keyword: "CHARACTER SET", ignoreExact: false },
      { keyword: "CHARSET", ignoreExact: false },
    ];
  }
}
