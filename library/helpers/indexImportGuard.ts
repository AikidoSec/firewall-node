const symbol = Symbol.for("zen.nodejs.index.run.once");

export function checkIndexImportGuard(): boolean {
  const globalState = globalThis as typeof globalThis & {
    [symbol]: boolean;
  };

  if (globalState[symbol]) {
    // eslint-disable-next-line no-console
    console.error(
      "AIKIDO: Zen has already been initialized. Please ensure that Zen is imported only once in your application, as importing it multiple times can lead to unexpected behavior."
    );

    return false;
  }

  globalState[symbol] = true;
  return true;
}
