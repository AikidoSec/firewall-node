import { escapeStringRegexp } from "../../helpers/escapeStringRegexp";
import { SQL_ESCAPE_SEQUENCES, SQL_STRING_CHARS } from "./config";

const escapeSequencesRegex = new RegExp(
  SQL_ESCAPE_SEQUENCES.map(escapeStringRegexp).join("|"),
  "gm"
);

export function userInputOccurrencesSafelyEncapsulated(
  query: string,
  userInput: string
) {
  const segmentsInBetween = getCurrentAndNextSegments(query.split(userInput));

  return segmentsInBetween.every(({ currentSegment, nextSegment }) => {
    const charBeforeUserInput = currentSegment.slice(-1);
    const quoteChar = SQL_STRING_CHARS.find(
      (char) => char === charBeforeUserInput
    );

    if (!quoteChar) {
      return false;
    }

    const charAfterUserInput = nextSegment.slice(0, 1);

    if (charBeforeUserInput !== charAfterUserInput) {
      return false;
    }

    if (userInput.includes(charBeforeUserInput)) {
      return false;
    }

    const withoutEscapeSequences = userInput.replace(escapeSequencesRegex, "");

    return !withoutEscapeSequences.includes("\\");
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
