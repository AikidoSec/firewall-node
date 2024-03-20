import { getCurrentAndNextSegments } from "../../helpers/getCurrentAndNextSegments";

export function detectShellInjection(
  command: string,
  userInput: string,
  pathToShell: string
): boolean {
  if (!command.includes(userInput)) {
    return false;
  }

  if (isSafelyEncapsulated(command, userInput)) {
    return false;
  }

  return containsShellSyntax(userInput, pathToShell);
}

function containsShellSyntax(userInput: string, pathToShell: string): boolean {
  // e.g. $(command ...args...)
  return /\$\(([^)]+)\)/.test(userInput);
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
