import { colorText } from "./colorText";
import { warnBox } from "./warnBox";

export function warnIfReactRouterServeIsUsed() {
  if (!isReactRouterServeUsed()) {
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

function isReactRouterServeUsed() {
  return process.argv.some(
    (arg) =>
      arg.includes("@react-router/serve") || arg.includes("react-router-serve")
  );
}
