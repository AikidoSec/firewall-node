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

  // Command separators (newline, carriage return, form feed) are dangerous
  // even as single characters when they separate actual content
  const commandSeparators = ["\n", "\r", "\f"];
  if (
    userInput.length === 1 &&
    commandSeparators.includes(userInput) &&
    command.includes(userInput)
  ) {
    // Check if it's safely encapsulated before flagging
    if (isSafelyEncapsulated(command, userInput)) {
      return false;
    }
    
    // Check if the separator is between non-whitespace content
    const parts = command.split(userInput);
    for (let i = 0; i < parts.length - 1; i++) {
      const before = parts[i];
      const after = parts[i + 1];
      
      // If there's non-whitespace content both before and after,
      // then the separator is being used to split commands
      if (before.trim().length > 0 && after.trim().length > 0) {
        return true;
      }
    }
  }

  if (userInput.length <= 1) {
    // We ignore single characters since they don't pose a big threat.
    // They are only able to crash the shell, not execute arbitrary commands.
    // Exception: command separators are handled above
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

  if (isSafelyEncapsulated(command, userInput)) {
    return false;
  }

  return containsShellSyntax(command, userInput);
}
