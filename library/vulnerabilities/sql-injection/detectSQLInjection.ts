import { SQLDialect } from "./dialects/SQLDialect";
import { shouldReturnEarly } from "./shouldReturnEarly";
import { isDebugging } from "../../helpers/isDebugging";
import {
  __wbg_reset_state as resetWasmInstance,
  wasm_detect_sql_injection,
} from "../../internals/zen_internals";

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
  const userInputNormalized = userInput.toLowerCase().trim();
  if (shouldReturnEarly(query, userInputNormalized)) {
    return SQLInjectionDetectionResult.SAFE;
  }

  let code: number;
  try {
    code = wasm_detect_sql_injection(
      query.toLowerCase(),
      userInputNormalized,
      dialect.getWASMDialectInt()
    );
  } catch {
    if (isDebugging()) {
      // oxlint-disable-next-line no-console
      console.warn(
        "AIKIDO: Zen could not check for SQL injection due to an internal error."
      );
    }
    // A failed WASM call poisons the current instance, so replace it.
    try {
      resetWasmInstance();
    } catch {
      // The WASM error is already handled, so a failed reset should not throw.
    }
    return SQLInjectionDetectionResult.INTERNAL_ERROR;
  }

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
