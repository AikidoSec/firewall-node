import { isPlainObject } from "../../helpers/isPlainObject";
import { detectJsInjection } from "./detectJsInjection";

// Operators accepting server-side JS code
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
  for (const [key, value] of Object.entries(filterPart)) {
    if (!serverSideJsFunctions.includes(key)) {
      continue;
    }

    const jsCode = extractStringToCheck(key, value);
    if (typeof jsCode !== "string" || jsCode.length < 1) {
      continue;
    }

    return detectJsInjection(jsCode, userInput);
  }

  return false;
}

/**
 * Gets the code string to check for injections from a $where, $function or $accumulator object
 */
function extractStringToCheck(key: string, value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (!isPlainObject(value) || !value) {
    return undefined;
  }

  if (key !== "$function" && key !== "$accumulator") {
    return undefined;
  }

  if (typeof value.lang === "string" && value.lang !== "js") {
    return undefined;
  }

  // We can ignore args, because mongo is interpreting the body as JS code and passes the args to the function as string arguments.
  // You can not break out of a JS string with quotes inside a JS string.
  if (key === "$function") {
    if (typeof value.body !== "string") {
      return undefined;
    }
    return value.body;
  } else if (key === "$accumulator") {
    return extractCodeFromAccumulator(value);
  }
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
