import { Hooks } from "./hooks/Hooks";
import {
  setBuiltinModulesToPatch,
  setPackagesToPatch,
  wrapRequire,
} from "./hooks/wrapRequire";
import { wrapExport } from "./hooks/wrapExport";
import {
  setImportBuiltinModulesToPatch,
  setImportPackagesToPatch,
  wrapImport,
} from "./hooks/wrapImport";

/**
 * Hooks allows you to register packages and then wrap specific methods on
 * the exports of the package. This doesn't do the actual wrapping yet.
 *
 * This method wraps the require function and sets up the hooks.
 * Globals are wrapped directly.
 */
export function applyHooks(hooks: Hooks, isESM: boolean) {
  if (!isESM) {
    // Todo check if we need to wrap require too in ESM mode under certain conditions
    setPackagesToPatch(hooks.getPackages());
    setBuiltinModulesToPatch(hooks.getBuiltInModules());
    wrapRequire();
  } else {
    setImportPackagesToPatch(hooks.getPackages());
    setImportBuiltinModulesToPatch(hooks.getBuiltInModules());
    wrapImport();
  }

  hooks.getGlobals().forEach((g) => {
    const name = g.getName();

    if (!(global as Record<string, unknown>)[name]) {
      return;
    }

    wrapExport(
      global,
      name,
      {
        name: name,
        type: "global",
      },
      g.getInterceptors()
    );
  });
}
