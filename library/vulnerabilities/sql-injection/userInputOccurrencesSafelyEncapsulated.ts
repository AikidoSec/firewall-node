import { escapeStringRegexp } from "../../helpers/escapeStringRegexp";
import { getCurrentAndNextSegments } from "../../helpers/getCurrentAndNextSegments";
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
    let charBeforeUserInput = currentSegment.slice(-1);
    let quoteChar = SQL_STRING_CHARS.find(
      (char) => char === charBeforeUserInput
    );

    // Special case for when the user input starts with a single quote
    // If the user input is `'value`
    // And the single quote is properly escaped with a backslash we split the following
    // `SELECT * FROM table WHERE column = '\'value'`
    // Into [`SELECT * FROM table WHERE column = '\`, `'`]
    // The char before the user input will be `\` and the char after the user input will be `'`
    if (
      !quoteChar &&
      userInput.startsWith("'") &&
      currentSegment.slice(-2) === "'\\"
    ) {
      quoteChar = "'";
      charBeforeUserInput = currentSegment.slice(-2, -1);
      userInput = userInput.slice(1);
    }

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
