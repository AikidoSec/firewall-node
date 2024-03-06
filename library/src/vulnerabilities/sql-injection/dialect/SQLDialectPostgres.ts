import { SQLDialect } from "./SQLDialect";

export class SQLDialectPostgres implements SQLDialect {
  getEscapedRanges(sql: string) {
    return [];
  }
}
