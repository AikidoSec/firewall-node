import { SQLDialect } from "./dialects/SQLDialect";
import { shouldReturnEarly } from "./shouldReturnEarly";
// eslint-disable-next-line camelcase
import { wasm_detect_sql_injection } from "../../internals/zen_internals";
import type { Source } from "../../agent/Source";

export function detectSQLInjection(
  query: string,
  userInput: string,
  dialect: SQLDialect,
  source: Source | undefined = undefined
) {
  if (shouldReturnEarly(query, userInput)) {
    return false;
  }

  // Ignore full SQL queries from the source aiToolParams
  // This is to prevent false positives when the AI tool is generating SQL queries
  // It was already checked in shouldReturnEarly that the query includes user input
  if (
    source &&
    source === "aiToolParams" &&
    query.length === userInput.length
  ) {
    return false;
  }

  return wasm_detect_sql_injection(
    query.toLowerCase(),
    userInput.toLowerCase(),
    dialect.getWASMDialectInt()
  );
}
