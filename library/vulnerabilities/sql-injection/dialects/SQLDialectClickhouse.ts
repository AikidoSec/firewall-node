/* eslint-disable max-lines-per-function */
import { SQLDialect } from "./SQLDialect";

export class SQLDialectClickhouse implements SQLDialect {
  getWASMDialectInt(): number {
    return 3;
  }
}
