import { SQLDialect } from "./SQLDialect";

export class SQLDialectSQLite implements SQLDialect {
  getWASMDialectInt(): number {
    return 12;
  }
}
