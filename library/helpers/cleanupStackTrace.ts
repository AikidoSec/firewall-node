import { escapeStringRegexp } from "./escapeStringRegexp";

const justACarrot = /^\^$/;

// eslint-disable-next-line max-lines-per-function
export function cleanupStackTrace(stack: string, libraryRoot: string): string {
  const pathRegex = new RegExp(escapeStringRegexp(libraryRoot) + "\\S*");

  const pathRegexWithLineNumbers = new RegExp(
    "^" + escapeStringRegexp(libraryRoot) + "\\S*(:\\d+){1,2}$"
  );

  return stack
    .split("\n")
    .filter((line) => {
      if (
        line.includes("cleanupStackTrace(") &&
        line.includes("new Error().stack!")
      ) {
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

      if (!line.trimStart().startsWith("at ")) {
        return true;
      }

      // Cleanup our own stack traces
      // Examples:
      // at Collection.wrap (/Code/runtime-node/build/agent/applyHooks.js:154:75)
      // at /Code/runtime-node/build/sources/express/wrapRequestHandler.js:22:20
      const parts = line.trimStart().split(" ");

      if (parts.length > 1) {
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
    })
    .map((line) => {
      if (line.trimStart().startsWith("at ")) {
        const parts = line.trimStart().split(" ");
        if (parts.length === 4) {
          const lastPart = parts[parts.length - 1];
          // Cleanup our own stack traces
          // Examples
          // at Object.unifiedUsers (/Users/hansott/Code/my-project/server/src/GraphQL/Mutation.ts:4491:31) /Users/hansott/Code/my-project/server/node_modules/@aikidosec/firewall
          return line.replace(pathRegex, "");
        }
      }

      return line;
    })
    .join("\n")
    .trim();
}
