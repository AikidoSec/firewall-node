/* eslint-disable max-lines-per-function */
import { SQLDialect } from "./SQLDialect";

export class SQLDialectPostgres implements SQLDialect {
  getDangerousStrings(): string[] {
    return ["$"];
  }
}
