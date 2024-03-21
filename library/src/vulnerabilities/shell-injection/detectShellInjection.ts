import { getCurrentAndNextSegments } from "../../helpers/getCurrentAndNextSegments";

export function detectShellInjection(
  command: string,
  userInput: string,
  pathToShell: string
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

  return containsShellSyntax(userInput, pathToShell);
}

function containsShellSyntax(userInput: string, pathToShell: string): boolean {
  // Check for patterns like $(command) or backticks
  return /\$\(([^)]+)\)/.test(userInput) || /`[^`]+`/.test(userInput);
}

function isSafelyEncapsulated(command: string, userInput: string) {
  return getCurrentAndNextSegments(command.split(userInput)).every(
    ({ currentSegment, nextSegment }) => {
      const charBeforeUserInput = currentSegment.slice(-1);
      const charAfterUserInput = nextSegment.slice(0, 1);

      if (charBeforeUserInput !== "'") {
        return false;
      }

      if (charBeforeUserInput !== charAfterUserInput) {
        return false;
      }

      return !userInput.includes(charBeforeUserInput);
    }
  );
}
