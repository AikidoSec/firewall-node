/* eslint-disable max-lines-per-function */
import { SQLDialect } from "./SQLDialect";

export class SQLDialectPostgres implements SQLDialect {
  getDangerousStrings(): string[] {
    return [
      // https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-DOLLAR-QUOTING
      "$",
    ];
  }

  getKeywords(): string[] {
    return [
      // https://www.postgresql.org/docs/current/sql-set.html
      "CLIENT_ENCODING",
    ];
  }
  getRustLibInteger(): number {
    // https://github.com/AikidoSec/zen-rustlib/blob/8267b4ebb4f5a77f26f44bdce3af751c93beba24/src/sql_injection/select_dialect_based_on_enum.rs#L30
    return 9;
  }
}
