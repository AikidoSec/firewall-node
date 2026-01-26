import { shouldReturnEarly } from "./shouldReturnEarly";
// eslint-disable-next-line camelcase
import { wasm_detect_js_injection } from "../../internals/zen_internals";

/**
 * Source types for the JavaScript parser in zen-internals.
 * @see https://github.com/AikidoSec/zen-internals/blob/main/src/js_injection/helpers/select_sourcetype_based_on_enum.rs
 */
export type JsSourceType =
  | "js" // JS, auto-detect CJS or ESM
  | "ts" // TypeScript (ESM)
  | "cjs" // CommonJS
  | "mjs" // ESM (.mjs)
  | "tsx"; // TSX (TypeScript with JSX)

function sourceTypeToNumber(sourceType: JsSourceType): number {
  switch (sourceType) {
    case "js":
      return 0;
    case "ts":
      return 1;
    case "cjs":
      return 2;
    case "mjs":
      return 3;
    case "tsx":
      return 4;
  }
}

/**
 * Detects if the user input is a JS injection
 */
export function detectJsInjection(
  code: string,
  userInput: string,
  sourceType: JsSourceType = "js"
): boolean {
  const codeLowercase = code.toLowerCase();
  const userInputLowercase = userInput.toLowerCase();

  if (shouldReturnEarly(codeLowercase, userInputLowercase)) {
    return false;
  }

  return wasm_detect_js_injection(
    codeLowercase,
    userInputLowercase,
    sourceTypeToNumber(sourceType)
  );
}
