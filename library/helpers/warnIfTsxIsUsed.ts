import { colorText } from "./colorText";
import { warnBox } from "./warnBox";

export function warnIfTsxIsUsed() {
  if (!isTsxUsed()) {
    return;
  }

  // oxlint-disable-next-line no-console
  console.warn(
    colorText(
      "red",
      warnBox(
        "Zen is NOT protecting your application when using tsx. Use node instead of tsx in production."
      )
    )
  );
}

function isTsxUsed() {
  return process.execArgv.some((arg) => arg.includes("tsx"));
}
