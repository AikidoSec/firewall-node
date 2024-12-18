import { getWrappers } from "../agent/getWrappers";
import { Hooks } from "../agent/hooks/Hooks";

export function externals() {
  const wrappers = getWrappers();
  const hooks = new Hooks();

  wrappers.forEach((wrapper) => {
    wrapper.wrap(hooks);
  });

  const packages = ["@aikidosec/firewall"].concat(
    hooks.getPackages().map((pkg) => pkg.getName())
  );

  // Remove duplicates
  return Array.from(new Set(packages));
}
