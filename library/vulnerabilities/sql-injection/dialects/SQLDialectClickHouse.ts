import { SQLDialect } from "./SQLDialect";

export class SQLDialectClickHouse implements SQLDialect {
  getWASMDialectInt(): number {
    return 3;
  }
  getHumanReadableName(): string {
    return "ClickHouse";
  }
}
