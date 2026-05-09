import { SQLDialect } from "./dialects/SQLDialect";
import { shouldReturnEarly } from "./shouldReturnEarly";
import { wasm_detect_sql_injection } from "../../internals/zen_internals";

export const SQLInjectionDetectionResult = {
  SAFE: 0,
  INJECTION_DETECTED: 1,
  INTERNAL_ERROR: 2,
  FAILED_TO_TOKENIZE: 3,
} as const;

export type SQLInjectionDetectionResultType =
  (typeof SQLInjectionDetectionResult)[keyof typeof SQLInjectionDetectionResult];

export function detectSQLInjection(
  query: string,
  userInput: string,
  dialect: SQLDialect
): SQLInjectionDetectionResultType {
  if (shouldReturnEarly(query, userInput)) {
    return SQLInjectionDetectionResult.SAFE;
  }

  const code = wasm_detect_sql_injection(
    query.toLowerCase(),
    userInput.toLowerCase(),
    dialect.getWASMDialectInt()
  );

  if (
    code === SQLInjectionDetectionResult.SAFE ||
    code === SQLInjectionDetectionResult.INJECTION_DETECTED ||
    code === SQLInjectionDetectionResult.INTERNAL_ERROR ||
    code === SQLInjectionDetectionResult.FAILED_TO_TOKENIZE
  ) {
    return code;
  }

  throw new Error("Unexpected return code from WASM: " + code);
}
