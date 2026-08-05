import { realpathSync } from "fs";
import { getModuleInfoFromPath } from "../agent/hooks/getModuleInfoFromPath";
import { colorText } from "./colorText";
import { getEntrypointFromCLIArgs } from "./getEntrypointFromCLIArgs";
import { warnBox } from "./warnBox";

export function warnIfReactRouterServeIsUsed() {
  const entrypoint = getEntrypointFromCLIArgs();
  if (!entrypoint) {
    return;
  }

  let resolved = entrypoint;
  try {
    resolved = realpathSync(entrypoint);
  } catch {
    // Ignore, use the unresolved path
  }

  const moduleInfo = getModuleInfoFromPath(resolved);
  if (!moduleInfo || moduleInfo.name !== "@react-router/serve") {
    return;
  }

  // oxlint-disable-next-line no-console
  console.warn(
    colorText(
      "red",
      warnBox(
        "Zen does NOT protect your application when using @react-router/serve. This framework is not supported yet. Normal Express apps are supported. Reach out if you need support."
      )
    )
  );
}
