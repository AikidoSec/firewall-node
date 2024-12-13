import { shouldReturnEarly } from "./shouldReturnEarly";
// eslint-disable-next-line camelcase
import { wasm_detect_js_injection } from "../../internals/zen_internals";

/**
 * Detects if the user input is a JS injection
 * The sourceType is used to determine the source of the user input
 * https://github.com/AikidoSec/zen-internals/blob/4b7bf2c7796155731dc2736a04e3f4d99cdc712b/src/js_injection/helpers/select_sourcetype_based_on_enum.rs#L4
 */
export function detectJsInjection(
  code: string,
  userInput: string,
  sourceType = 0
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
