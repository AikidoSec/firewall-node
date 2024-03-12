import { SQL_STRING_CHARS } from "./config";

export function userInputOccurrencesSafelyEncapsulated(
  query: string,
  userInput: string
) {
  const segmentsInBetween = getCurrentAndNextSegments(query.split(userInput));

  return segmentsInBetween.every(({ currentSegment, nextSegment }) => {
    const charBeforeUserInput = currentSegment.slice(-1);
    const quoteChar = SQL_STRING_CHARS.find(
      (char) => char.char === charBeforeUserInput
    );

    if (!quoteChar) {
      return false;
    }

    const charAfterUserInput = nextSegment.slice(0, 1);

    if (charBeforeUserInput !== charAfterUserInput) {
      return false;
    }

    if (quoteChar.canUseBackwardSlash) {
      return charAppearsInsideUserInputUnescaped(
        userInput,
        charBeforeUserInput
      );
    }

    return !userInput.includes(charBeforeUserInput);
  });
}

function getCurrentAndNextSegments<T>(
  array: T[]
): { currentSegment: T; nextSegment: T }[] {
  return array.slice(0, -1).map((currentItem, index) => ({
    currentSegment: currentItem,
    nextSegment: array[index + 1],
  }));
}

function charAppearsInsideUserInputUnescaped(userInput: string, char: string) {
  let escaped = false;
  for (let i = 0; i < userInput.length; i++) {
    if (!escaped && userInput[i] === "\\") {
      escaped = true;
      continue;
    }

    if (userInput[i] === char) {
      if (!escaped) {
        return false;
      }

      escaped = false;
    }

    escaped = false;
  }

  return !escaped;
}
