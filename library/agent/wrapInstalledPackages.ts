import { isAnyPkgAlreadyRequired } from "../helpers/isAnyPkgAlreadyRequired";
import { applyHooks } from "./applyHooks";
import { Hooks } from "./hooks/Hooks";
import { Wrapper } from "./Wrapper";

export function wrapInstalledPackages(
  wrappers: Wrapper[],
  newInstrumentation: boolean,
  serverless: string | undefined,
  isBundlingProcess: boolean
) {
  const hooks = new Hooks();
  wrappers.forEach((wrapper) => {
    wrapper.wrap(hooks);
  });

  if (
    !serverless &&
    !isBundlingProcess &&
    isAnyPkgAlreadyRequired(hooks.getPackages())
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      "AIKIDO: Some packages can't be protected because they were imported before Zen was initialized. Please make sure to import Zen as the first module in your application."
    );
  }

  return applyHooks(hooks, newInstrumentation, isBundlingProcess);
}
