import { containsUnsafePathParts } from "../path-traversal/containsUnsafePathParts";
import { containsShellSyntax } from "./containsShellSyntax";
import { isSafelyEncapsulated } from "./isSafelyEncapsulated";

export function detectShellInjection(
  command: string,
  userInput: string
): boolean {
  // Block single ~ character. For example echo ~
  if (userInput === "~") {
    if (command.length > 1 && command.includes("~")) {
      return true;
    }
  }

  if (userInput.length <= 1) {
    // We ignore single characters since they don't pose a big threat.
    // They are only able to crash the shell, not execute arbitrary commands.
    return false;
  }

  if (userInput.length > command.length) {
    // We ignore cases where the user input is longer than the command.
    // Because the user input can't be part of the command.
    return false;
  }

  if (!command.includes(userInput)) {
    return false;
  }

  if (containsUnsafePathParts(userInput) && containsUnsafePathParts(command)) {
    return true;
  }

  if (isSafelyEncapsulated(command, userInput)) {
    return false;
  }

  return containsShellSyntax(command, userInput);
}
