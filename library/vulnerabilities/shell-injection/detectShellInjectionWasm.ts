import { wasm_detect_shell_injection } from "../../internals/zen_internals";

const INJECTION_DETECTED = 1;
const FAILED_TO_TOKENIZE = 3;

/**
 * Detects shell injection using the Rust/WASM tokenizer-based algorithm.
 * This provides more accurate detection than the TypeScript-based approach
 * by tokenizing the shell command and checking if user input changes the token structure.
 *
 * In strict mode, commands that fail to tokenize are also blocked — if the
 * tokenizer can't parse the syntax, it may be a bypass attempt or non-POSIX syntax.
 */
export function detectShellInjectionWasm(
  command: string,
  userInput: string
): boolean {
  // Block single ~ character (tilde expansion)
  if (userInput === "~") {
    if (command.length > 1 && command.includes("~")) {
      return true;
    }
  }

  if (userInput.length <= 1) {
    return false;
  }

  if (userInput.length > command.length) {
    return false;
  }

  if (!command.includes(userInput)) {
    return false;
  }

  const result = wasm_detect_shell_injection(command, userInput);

  return result === INJECTION_DETECTED || result === FAILED_TO_TOKENIZE;
}
