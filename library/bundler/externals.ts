import { Hooks } from "../agent/hooks/Hooks";
import { getWrappers } from "../agent/protect";

export function externals() {
  const wrappers = getWrappers();
  const hooks = new Hooks();

  wrappers.forEach((wrapper) => {
    wrapper.wrap(hooks);
  });

  return ["@aikidosec/firewall"].concat(
    hooks.getPackages().map((pkg) => pkg.getName())
  );
}
