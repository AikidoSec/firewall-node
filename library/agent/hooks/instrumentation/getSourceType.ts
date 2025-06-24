export type PackageLoadFormat = "commonjs" | "module" | "unambiguous";

type SourceType = "unambiguous" | "ts" | "cjs" | "mjs" | "tsx" | "jsx";

/**
 * Get the source type based on the file extension and package load format.
 */
export function getSourceType(
  path: string,
  loadFormat: PackageLoadFormat
): SourceType {
  const extension = path.split(".").pop();

  switch (extension) {
    case "js": {
      if (loadFormat === "commonjs") {
        return "cjs";
      }
      if (loadFormat === "module") {
        return "mjs";
      }
      return "unambiguous"; // JS, auto-detect CJS or ESM
    }
    case "ts": // Parsed as ESM module system
    case "cjs":
    case "mjs":
    case "tsx":
    case "jsx": {
      return extension;
    }

    default: {
      throw new Error(`Unsupported file extension: ${extension}`);
    }
  }
}
