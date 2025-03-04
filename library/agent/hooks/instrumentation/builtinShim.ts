import { join } from "path";
import { getExportsForBuiltin } from "./getExportsForBuiltin";

export function generateBuildinShim(
  builtinName: string,
  builtinNameWithoutPrefix: string,
  isCJSRequire: boolean
): string | undefined {
  let importPath = "@aikidosec/firewall/instrument/internals";
  if (process.env.AIKIDO_UNIT_TEST === "true") {
    importPath = join(__dirname, "injectedFunctions");
  }

  if (isCJSRequire) {
    return `const orig = process.getBuiltinModule(${JSON.stringify(builtinName)});
    const { __wrapBuiltinExports } = require('${importPath}');
      
    module.exports = __wrapBuiltinExports("${builtinNameWithoutPrefix}", orig);
    `;
  }

  const modExports = getExportsForBuiltin(builtinNameWithoutPrefix);
  if (!modExports) {
    return undefined;
  }
  const exportArray = Array.from(modExports);

  return `const orig = process.getBuiltinModule(${JSON.stringify(builtinName)});
    const { __wrapBuiltinExports } = require('${importPath}');

    const wrapped = __wrapBuiltinExports("${builtinNameWithoutPrefix}", orig);
    
    Object.defineProperty(exports, "__esModule", { value: true });

    ${exportArray
      .map((key) => {
        return `exports.${key} = wrapped.${key};`;
      })
      .join("\n")};
  `;
}
