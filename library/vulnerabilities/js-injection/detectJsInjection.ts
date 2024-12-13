import { shouldReturnEarly } from "./shouldReturnEarly";
// eslint-disable-next-line camelcase
import { wasm_detect_js_injection } from "../../internals/zen_internals";

export function detectJsInjection(query: string, userInput: string) {
  const queryLowercase = query.toLowerCase();
  const userInputLowercase = userInput.toLowerCase();

  if (shouldReturnEarly(queryLowercase, userInputLowercase)) {
    return false;
  }

  // The source type is currently hardcoded to 0 (CJS & ESM)
  return wasm_detect_js_injection(queryLowercase, userInputLowercase, 0);
}
