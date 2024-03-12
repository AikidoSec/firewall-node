import { SQL_STRING_CHARS } from "./config";

export function userInputOccurrencesSafelyEncapsulated(
  query: string,
  userInput: string
) {
  const segmentsInBetween = getCurrentAndNextSegments(query.split(userInput));

  return segmentsInBetween.every(({ currentSegment, nextSegment }) => {
    const lastChar = currentSegment.slice(-1);

    if (!SQL_STRING_CHARS.map((char) => char.char).includes(lastChar)) {
      return false;
    }

    const nextChar = nextSegment.slice(0, 1);

    if (lastChar !== nextChar) {
      return false;
    }

    return !userInput.includes(lastChar);
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
