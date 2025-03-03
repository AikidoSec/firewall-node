export function generateBuildinShim(
  builtinName: string,
  builtinNameWithoutPrefix: string,
  format: "commonjs" | "module"
): string | undefined {
  // Todo fix broken with ESM
  // Todo access unwrapped methods inside our own library to prevent infinite recursion

  if (format === "module") {
    return `const orig = process.getBuiltinModule(${JSON.stringify(builtinName)});
    import { __wrapBuiltinExports } from '@aikidosec/firewall/instrument/internals';

    export default __wrapBuiltinExports("${builtinNameWithoutPrefix}", orig);
  `;
  }

  return `const orig = process.getBuiltinModule(${JSON.stringify(builtinName)});
const { __wrapBuiltinExports } = require('@aikidosec/firewall/instrument/internals');
  
module.exports = __wrapBuiltinExports("${builtinNameWithoutPrefix}", orig);
`;
}
