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
  const dangerousShellStrings = ["!", "*", "$", "`", "\\"];

  return dangerousShellStrings.some((shellString) =>
    userInput.includes(shellString)
  );
}

function isSafelyEncapsulated(command: string, userInput: string) {
  const escapeChars = ['"', "'"];
  const dangerousCharsInsideDoubleQuotes = ["$", "`", "\\", "!"];

  return getCurrentAndNextSegments(command.split(userInput)).every(
    ({ currentSegment, nextSegment }) => {
      const charBeforeUserInput = currentSegment.slice(-1);
      const charAfterUserInput = nextSegment.slice(0, 1);

      const isEscapeChar = escapeChars.find(
        (char) => char === charBeforeUserInput
      );

      if (!isEscapeChar) {
        return false;
      }

      if (charBeforeUserInput !== charAfterUserInput) {
        return false;
      }

      if (userInput.includes(charBeforeUserInput)) {
        return false;
      }

      if (
        isEscapeChar === '"' &&
        dangerousCharsInsideDoubleQuotes.some((char) =>
          userInput.includes(char)
        )
      ) {
        return false;
      }

      return true;
    }
  );
}
