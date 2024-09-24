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
  getRustLibInteger(): number {
    // https://github.com/AikidoSec/zen-rustlib/blob/8267b4ebb4f5a77f26f44bdce3af751c93beba24/src/sql_injection/select_dialect_based_on_enum.rs#L29
    return 8;
  }
}
