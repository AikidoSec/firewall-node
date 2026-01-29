import { shouldReturnEarly } from "./shouldReturnEarly";
import { wasm_detect_js_injection } from "../../internals/zen_internals";

type ZenInternalsJsSourceType =
  | 0 // js (auto-detect CJS or ESM)
  | 1 // ts (TypeScript)
  | 2 // cjs (CommonJS)
  | 3 // mjs (ESM)
  | 4; // tsx (TypeScript with JSX)

/**
 * Detects if the user input is a JS injection
 * The sourceType is used to determine the source of the user input
 * https://github.com/AikidoSec/zen-internals/blob/4b7bf2c7796155731dc2736a04e3f4d99cdc712b/src/js_injection/helpers/select_sourcetype_based_on_enum.rs#L4
 */
export function detectJsInjection(
  code: string,
  userInput: string,
  // Assume CommonJS by default, as eval() and new Function() can not execute ESM directly
  // The oxc parser has a bug that causes HTML-like comments to not be parsed in the unambiguous mode
  // See https://github.com/oxc-project/oxc/issues/18392
  sourceType: ZenInternalsJsSourceType = 2
): boolean {
  const codeLowercase = code.toLowerCase();
  const userInputLowercase = userInput.toLowerCase();

  if (shouldReturnEarly(codeLowercase, userInputLowercase)) {
    return false;
  }

  return wasm_detect_js_injection(
    codeLowercase,
    userInputLowercase,
    sourceType
  );
}
