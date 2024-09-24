/* eslint-disable max-lines-per-function */
import { SQLDialect } from "./SQLDialect";

export class SQLDialectSQLite implements SQLDialect {
  getDangerousStrings(): string[] {
    return [];
  }

  getKeywords(): string[] {
    return ["VACUUM", "ATTACH", "DETACH"];
  }
  getRustLibInteger(): number {
    // https://github.com/AikidoSec/zen-rustlib/blob/8267b4ebb4f5a77f26f44bdce3af751c93beba24/src/sql_injection/select_dialect_based_on_enum.rs#L33
    return 12;
  }
}
