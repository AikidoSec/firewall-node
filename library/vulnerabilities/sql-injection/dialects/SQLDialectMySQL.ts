import { SQLDialect } from "./SQLDialect";

export class SQLDialectMySQL implements SQLDialect {
  getWASMDialectInt(): number {
    return 8;
  }
  getHumanReadableName(): string {
    return "MySQL";
  }
}
