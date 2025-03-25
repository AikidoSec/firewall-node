export type PackageLoadFormat = "commonjs" | "module" | "unambiguous";

/*
    0 -> JS, auto-detect CJS or ESM
    1 -> TypeScript (ESM)
    2 -> CJS
    3 -> MJS (ESM)
    4 -> TSX
*/
export function getSourceType(
  path: string,
  loadFormat: PackageLoadFormat
): number {
  const extension = path.split(".").pop();

  switch (extension) {
    case "js": {
      if (loadFormat === "commonjs") {
        return 2;
      }
      if (loadFormat === "module") {
        return 3;
      }
      return 0; // JS, auto-detect CJS or ESM (unambiguous)
    }
    case "ts": {
      return 1;
    }
    case "cjs": {
      return 2;
    }
    case "mjs": {
      return 3;
    }
    case "tsx": {
      return 4;
    }

    default: {
      throw new Error(`Unsupported file extension: ${extension}`);
    }
  }
}
