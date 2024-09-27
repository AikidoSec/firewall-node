import { applyHooks } from "./applyHooks";
import { Hooks } from "./hooks/Hooks";
import { Wrapper } from "./Wrapper";

export function wrapInstalledPackages(wrappers: Wrapper[], isESM: boolean) {
  const hooks = new Hooks();
  wrappers.forEach((wrapper) => {
    wrapper.wrap(hooks);
  });

  return applyHooks(hooks, isESM);
}
