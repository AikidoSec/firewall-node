import { escapeStringRegexp } from "./escapeStringRegexp";

export function cleanupStackTrace(stack: string, libraryRoot: string): string {
  try {
    return stack
      .split("\n")
      .filter(createLineFilter(libraryRoot))
      .map(createLineMapper(libraryRoot))
      .join("\n")
      .trim();
  } catch {
    // Safer to return the original stack trace in case of an error
    // than to crash the application
    return stack;
  }
}

function createLineFilter(libraryRoot: string) {
  const justACarrot = /^\^$/;
  const pathRegexWithLineNumbers = new RegExp(
    "^" + escapeStringRegexp(libraryRoot) + "\\S*(:\\d+){1,2}$"
  );

  return function lineFilter(line: string) {
    if (line.includes("cleanupStackTrace") && line.includes("new Error")) {
      return false;
    }

    // /Users/hansott/Code/my-project/server/node_modules/@aikidosec/firewall/agent/applyHooks.js:152
    if (pathRegexWithLineNumbers.test(line.trimStart())) {
      return false;
    }

    // Cleanup carrot under new Error().stack!
    // stack: cleanupStackTrace(new Error().stack!, libraryRoot),
    //                           ^
    if (justACarrot.test(line.trimStart())) {
      return false;
    }

    // Cleanup our own stack traces
    // Examples:
    // at Collection.wrap (/Code/runtime-node/build/agent/applyHooks.js:154:75)
    // at /Code/runtime-node/build/sources/express/wrapRequestHandler.js:22:20
    const parts = line.trimStart().split(" ");

    if (parts.length > 1 && line.trimStart().startsWith("at ")) {
      const lastPart = parts[parts.length - 1];

      if (
        lastPart.startsWith("(") &&
        lastPart.endsWith(")") &&
        pathRegexWithLineNumbers.test(lastPart.slice(1, -1))
      ) {
        return false;
      }

      if (pathRegexWithLineNumbers.test(lastPart)) {
        return false;
      }
    }

    return true;
  };
}

function createLineMapper(libraryRoot: string) {
  const pathRegex = new RegExp(escapeStringRegexp(libraryRoot) + "\\S*");

  return function lineMapper(line: string) {
    if (line.trimStart().startsWith("at ")) {
      const parts = line.trimStart().split(" ");
      if (parts.length === 4) {
        // Cleanup our own stack traces
        // Examples
        // at Object.unifiedUsers (/Users/hansott/Code/my-project/server/src/GraphQL/Mutation.ts:4491:31) /Users/hansott/Code/my-project/server/node_modules/@aikidosec/firewall
        return line.replace(pathRegex, "");
      }
    }

    return line;
  };
}
