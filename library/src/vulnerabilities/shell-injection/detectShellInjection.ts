export function detectShellInjection(
  command: string,
  userInput: string,
  pathToShell: string
): boolean {
  if (!command.includes(userInput)) {
    return false;
  }

  const segmentsInBetween = getCurrentAndNextSegments(command.split(userInput));

  if (
    segmentsInBetween.every(({ currentSegment, nextSegment }) => {
      const charBeforeUserInput = currentSegment.slice(-1);
      const charAfterUserInput = nextSegment.slice(0, 1);

      if (charBeforeUserInput !== "'") {
        return false;
      }

      if (charBeforeUserInput !== charAfterUserInput) {
        return false;
      }

      if (userInput.includes(charBeforeUserInput)) {
        return false;
      }

      return true;
    })
  ) {
    return false;
  }

  return containsShellSyntax(userInput, pathToShell);
}

function getCurrentAndNextSegments<T>(
  array: T[]
): { currentSegment: T; nextSegment: T }[] {
  return array.slice(0, -1).map((currentItem, index) => ({
    currentSegment: currentItem,
    nextSegment: array[index + 1],
  }));
}

function containsShellSyntax(userInput: string, pathToShell: string): boolean {
  return /\$\(([^)]+)\)/.test(userInput);
}
