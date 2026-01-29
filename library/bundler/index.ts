import { externals } from "./externals";
import { basePlugin } from "./internal/unplugin";

const zenEsbuildPlugin = basePlugin.esbuild;
const zenRolldownPlugin = basePlugin.rolldown;

export { externals, zenEsbuildPlugin, zenRolldownPlugin };
