export function getInternalDispatcherOptions(
  instance: object
): { connect?: unknown } | undefined {
  const optionsSymbol = Object.getOwnPropertySymbols(instance).find(
    (sym) => sym.description === "options"
  );

  if (!optionsSymbol) {
    return undefined;
  }

  return (instance as Record<PropertyKey, unknown>)[optionsSymbol] as
    | { connect?: unknown }
    | undefined;
}
