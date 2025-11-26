// oxlint-disable no-console
import { compileCustomPattern } from "../helpers/buildRouteFromURL";

const registeredPatterns: RegExp[] = [];
const registeredPatternsSet: Set<string> = new Set();

export function addRouteParam(pattern: string) {
  if (!pattern.includes("{") || !pattern.includes("}")) {
    console.warn(
      "addRouteParam(...) expects a pattern that includes {digits} or {alpha}."
    );
    return;
  }

  if (pattern.includes("/")) {
    console.warn("addRouteParam(...) expects a pattern without slashes.");
    return;
  }

  const regex = compileCustomPattern(pattern);
  if (!regex) {
    console.warn(
      "addRouteParam(...) could not compile the provided pattern into a valid regular expression."
    );
    return;
  }

  if (registeredPatternsSet.has(pattern)) {
    return;
  }

  registeredPatternsSet.add(pattern);
  registeredPatterns.push(regex);
}

export function getRegisteredRouteParams(): RegExp[] {
  return registeredPatterns;
}
