import { tokenize as wasmTokenize } from "../../sql-tokenizer/sql_tokenizer";

export function tokenize(
  dialect: "mysql" | "postgres" | "sqlite",
  sql: string
) {
  return wasmTokenize(dialect, sql);
}
