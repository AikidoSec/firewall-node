import { getExportsForBuiltin } from "./getExportsForBuiltin";

export function generateBuildinShim(
  builtinName: string,
  builtinNameWithoutPrefix: string,
  isCJSRequire: boolean
): string | undefined {
  // Todo access unwrapped methods inside our own library to prevent infinite recursion

  if (isCJSRequire) {
    return `const orig = process.getBuiltinModule(${JSON.stringify(builtinName)});
    const { __wrapBuiltinExports } = require('@aikidosec/firewall/instrument/internals');
      
    module.exports = __wrapBuiltinExports("${builtinNameWithoutPrefix}", orig);
    `;
  }

  const modExports = getExportsForBuiltin(builtinNameWithoutPrefix);
  if (!modExports) {
    return undefined;
  }
  const exportArray = Array.from(modExports);

  return `const orig = process.getBuiltinModule(${JSON.stringify(builtinName)});
    const { __wrapBuiltinExports } = require('@aikidosec/firewall/instrument/internals');

    const wrapped = __wrapBuiltinExports("${builtinNameWithoutPrefix}", orig);
    
    Object.defineProperty(exports, "__esModule", { value: true });

    ${exportArray
      .map((key) => {
        return `exports.${key} = wrapped.${key};`;
      })
      .join("\n")};
  `;
}
