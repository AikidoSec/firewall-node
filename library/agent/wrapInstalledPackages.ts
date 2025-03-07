import { applyHooks } from "./applyHooks";
import { Hooks } from "./hooks/Hooks";
import { Wrapper } from "./Wrapper";

export function wrapInstalledPackages(
  wrappers: Wrapper[],
  newInstrumentation: boolean
) {
  const hooks = new Hooks();
  wrappers.forEach((wrapper) => {
    wrapper.wrap(hooks);
  });

  return applyHooks(hooks, newInstrumentation);
}
