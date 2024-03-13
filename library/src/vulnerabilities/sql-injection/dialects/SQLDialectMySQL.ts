/* eslint-disable max-lines-per-function */
import { SQLDialect } from "./SQLDialect";

export class SQLDialectMySQL implements SQLDialect {
  getDangerousStrings(): string[] {
    return [];
  }
}
