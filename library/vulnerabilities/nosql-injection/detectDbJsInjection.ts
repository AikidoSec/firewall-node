import { getCurrentAndNextSegments } from "../../helpers/getCurrentAndNextSegments";
import { isPlainObject } from "../../helpers/isPlainObject";

const serverSideJsFunctions = ["$where", "$accumulator", "$function"];

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
      // We can ignore args, because mongo is interpreting the body as JS code and passes the args to the function as string arguments.
      // You can not break out of a JS string with quotes inside a JS string.
      if (key === "$function" && isPlainObject(value) && value) {
        if (typeof value.lang === "string" && value.lang !== "js") {
          continue;
        }
        if (typeof value.body === "string") {
          strToCheck = value.body;
        }
      }

      if (key === "$accumulator" && isPlainObject(value) && value) {
        if (typeof value.lang === "string" && value.lang !== "js") {
          continue;
        }
        if (typeof value.init === "string") {
          strToCheck = value.init;
        }
        if (typeof value.accumulate === "string") {
          strToCheck += value.accumulate;
        }
        if (typeof value.merge === "string") {
          strToCheck += value.merge;
        }
        if (typeof value.finalize === "string") {
          strToCheck += value.finalize;
        }
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
