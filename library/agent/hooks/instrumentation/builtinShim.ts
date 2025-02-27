import { getExportsForBuiltin } from "./getExportsForBuiltin";
import { BuiltinInstrumentationInstruction } from "./types";

export function generateBuildinShim(
  moduleName: string,
  instructions: BuiltinInstrumentationInstruction["functions"]
): string | undefined {
  const exports = getExportsForBuiltin(moduleName);

  // Filter out non-existing exports
  const methods = instructions.filter((m) => exports.has(m.name));

  if (methods.length === 0) {
    // No methods to instrument, return undefined
    return;
  }

  const unpatchedExports = instructions.filter(
    (m) => !methods.some((method) => method.name === m.name)
  );

  return `
        const orig = process.getBuiltinModule(${JSON.stringify(moduleName)});
        const { __instrumentInspectArgs } = require('@aikidosec/firewall/instrument/internals');

        ${methods
          .map(
            (method) => `
                exports.${method.name} = function() {
                    ${method.inspectArgs ? `__instrumentInspectArgs("${moduleName}.${method.name}", arguments);` : ""}
                    return orig.${method.name}(...arguments);
                };`
          )
          .join("\n")}
            
            // Export all other properties and methods directly
            ${unpatchedExports
              .map((method) => `exports.${method.name} = orig.${method.name};`)
              .join("\n")}
    `;
}
