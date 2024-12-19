import { SQLDialect } from "./SQLDialect";

export class SQLDialectGeneric implements SQLDialect {
  getWASMDialectInt(): number {
    return 0;
  }
}
