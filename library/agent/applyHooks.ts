import { Hooks } from "./hooks/Hooks";
import {
  setBuiltinModulesToPatch,
  setPackagesToPatch,
  wrapRequire,
} from "./hooks/wrapRequire";
import { wrapExport } from "./hooks/wrapExport";
import { registerNodeHooks } from "./hooks/instrumentation/index";
import {
  setBuiltinsToInstrument,
  setPackagesToInstrument,
} from "./hooks/instrumentation/instructions";

/**
 * Hooks allows you to register packages and then wrap specific methods on
 * the exports of the package. This doesn't do the actual wrapping yet.
 *
 * This method wraps the require function and sets up the hooks.
 * Globals are wrapped directly.
 */
export function applyHooks(
  hooks: Hooks,
  newInstrumentation: boolean,
  isBundlingProcess: boolean = false
) {
  if (!newInstrumentation) {
    setPackagesToPatch(hooks.getPackages());
    setBuiltinModulesToPatch(hooks.getBuiltInModules());

    if (!isBundlingProcess) {
      // No need to wrap require during the bundling process
      wrapRequire();
    }
  } else {
    setPackagesToInstrument(hooks.getPackages());
    setBuiltinsToInstrument(hooks.getBuiltInModules());
    if (!isBundlingProcess) {
      // No need to register hooks during the bundling process
      registerNodeHooks();
    }
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
