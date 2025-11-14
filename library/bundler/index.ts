import { externals } from "./externals";
import { basePlugin } from "./internal/unplugin";

const zenEsbuildPlugin = basePlugin.esbuild;

export { externals, zenEsbuildPlugin };
