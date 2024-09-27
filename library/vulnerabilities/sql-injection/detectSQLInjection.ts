import { SQLDialect } from "./dialects/SQLDialect";
import { shouldReturnEarly } from "./shouldReturnEarly";
// eslint-disable-next-line camelcase
import { wasm_detect_sql_injection } from "@aikidosec/zen-internals";

export function detectSQLInjection(
  query: string,
  userInput: string,
  dialect: SQLDialect
) {
  if (shouldReturnEarly(query, userInput)) {
    return false;
  }

  return wasm_detect_sql_injection(
    query,
    userInput,
    dialect.getWASMDialectInt()
  );
}
