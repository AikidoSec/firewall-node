import { isAnyPkgAlreadyRequired } from "../helpers/isAnyPkgAlreadyRequired";
import { applyHooks } from "./applyHooks";
import { Hooks } from "./hooks/Hooks";
import { Wrapper } from "./Wrapper";

export function wrapInstalledPackages(wrappers: Wrapper[]) {
  const hooks = new Hooks();
  wrappers.forEach((wrapper) => {
    wrapper.wrap(hooks);
  });

  if (isAnyPkgAlreadyRequired(hooks.getPackages())) {
    // eslint-disable-next-line no-console
    console.warn(
      "Aikido: Some packages can't be protected because they were imported before Aikido was initialized. Please make sure to import Aikido as the first module in your application."
    );
  }

  return applyHooks(hooks);
}
