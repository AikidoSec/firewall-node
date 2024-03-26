import { containsShellSyntax } from "./containsShellSyntax";
import { isSafelyEncapsulated } from "./isSafelyEncapsulated";

export function detectShellInjection(
  command: string,
  userInput: string
): boolean {
  if (userInput.length <= 1) {
    // We ignore single characters since they don't pose a big threat.
    // They are only able to crash the shell, not execute arbitrary commands.
    return false;
  }

  if (!command.includes(userInput)) {
    return false;
  }

  if (isSafelyEncapsulated(command, userInput)) {
    return false;
  }

  return containsShellSyntax(command, userInput);
}
