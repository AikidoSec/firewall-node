const symbol = Symbol.for("zen.nodejs.index.run.once");

export function checkIndexImportGuard(): boolean {
  const globalState = globalThis as typeof globalThis & {
    [symbol]: boolean;
  };

  if (globalState[symbol]) {
    // oxlint-disable-next-line no-console
    console.error(
      "AIKIDO: Zen has already been initialized. This can lead to unexpected behavior and may be caused by cleaning the require cache or using multiple installations of Zen at the same time."
    );

    return false;
  }

  globalState[symbol] = true;
  return true;
}
