export function getExportsForBuiltin(name: string) {
  const mod = process.getBuiltinModule(name);

  if (!mod) {
    return undefined;
  }

  return new Set(["default", ...Object.keys(mod)]);
}
