import { SQLDialect } from "./SQLDialect";

export class SQLDialectPostgres implements SQLDialect {
  getWASMDialectInt(): number {
    return 9;
  }
}
