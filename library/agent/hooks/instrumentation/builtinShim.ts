import { getExportsForBuiltin } from "./getExportsForBuiltin";
import { BuiltinInstrumentationInstructionJSON } from "./types";

export function generateBuildinShim(
  builtinName: string,
  builtinNameWithoutPrefix: string,
  instructions: BuiltinInstrumentationInstructionJSON["functions"]
): string | undefined {
  const exports = getExportsForBuiltin(builtinName);

  // Filter out non-existing exports
  const methods = instructions.filter((m) => exports.has(m.name));

  if (methods.length === 0) {
    // No methods to instrument, return undefined
    return;
  }

  const unpatchedExports = Array.from(exports).filter(
    (m: any) => !methods.some((method) => method.name === m.name)
  );

  // Todos: Copy over properties of patched methods?
  // Todo check default export !!!
  return `const orig = process.getBuiltinModule(${JSON.stringify(builtinName)});
const { __instrumentInspectArgs } = require('@aikidosec/firewall/instrument/internals');

${methods
  .map(
    (method) => `
  exports.${method.name} = function() {
    ${method.inspectArgs ? `__instrumentInspectArgs("${builtinNameWithoutPrefix}.${method.name}", true, arguments);` : ""}
    return orig.${method.name}(...arguments);
  };`
  )
  .join("\n")}
  
  ${unpatchedExports.map((e) => `exports.${e} = orig.${e};`).join("\n")}
`;
}
