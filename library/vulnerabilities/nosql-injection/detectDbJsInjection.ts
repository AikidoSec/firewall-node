import { getCurrentAndNextSegments } from "../../helpers/getCurrentAndNextSegments";
import { isPlainObject } from "../../helpers/isPlainObject";

const serverSideJsFunctions = ["$where", "$accumulator", "$function"];

/**
 * Checks if the user input is part of queries that execute JS code on the server.
 * If the user input is part of the query and not safely encapsulated, it's considered an injection.
 * Because strings are always encapsulated in quotes in JS, every non-encapsulated user input is an injection.
 */
export function detectDbJsInjection(
  userInput: string,
  filterPart: Record<string, unknown>
): boolean {
  if (userInput.length < 1) {
    // We ignore single characters since they don't pose a big threat.
    return false;
  }

  for (const [key, value] of Object.entries(filterPart)) {
    if (!serverSideJsFunctions.includes(key)) {
      continue;
    }

    let strToCheck = "";

    if (typeof value === "string") {
      strToCheck = value;
    } else {
      if (!isPlainObject(value) || !value) {
        continue;
      }

      if (key !== "$function" && key !== "$accumulator") {
        continue;
      }

      if (typeof value.lang === "string" && value.lang !== "js") {
        continue;
      }

      // We can ignore args, because mongo is interpreting the body as JS code and passes the args to the function as string arguments.
      // You can not break out of a JS string with quotes inside a JS string.
      if (key === "$function") {
        if (typeof value.body !== "string") {
          continue;
        }
        strToCheck = value.body;
      } else if (key === "$accumulator") {
        strToCheck = extractCodeFromAccumulator(value);
      }
    }

    if (typeof strToCheck !== "string" || strToCheck.length < 1) {
      continue;
    }

    // We ignore cases where the user input is longer than the command.
    // Because the user input can't be part of the command.
    if (userInput.length > strToCheck.length) {
      continue;
    }

    // User input is not part of the command
    if (!strToCheck.includes(userInput)) {
      continue;
    }

    // User input is safely encapsulated
    if (isSafelyEncapsulated(strToCheck, userInput)) {
      continue;
    }

    return true;
  }

  return false;
}

const escapeChars = ['"', "'", "`"];

/**
 * Check if the user input is safely encapsulated in the query
 */
function isSafelyEncapsulated(filterString: string, userInput: string) {
  return getCurrentAndNextSegments(filterString.split(userInput)).every(
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

      return true;
    }
  );
}

/**
 * Gets all js code strings from the $accumulator object and concatenates them
 */
function extractCodeFromAccumulator(accumulator: Record<string, unknown>) {
  let strToCheck = "";
  if (typeof accumulator.init === "string") {
    strToCheck = accumulator.init;
  }
  if (typeof accumulator.accumulate === "string") {
    strToCheck += accumulator.accumulate;
  }
  if (typeof accumulator.merge === "string") {
    strToCheck += accumulator.merge;
  }
  if (typeof accumulator.finalize === "string") {
    strToCheck += accumulator.finalize;
  }
  return strToCheck;
}
