import { colorText } from "./colorText";

export function warnIfTsxIsUsed() {
  if (!isTsxUsed()) {
    return;
  }

  // oxlint-disable-next-line no-console
  console.warn(
    colorText(
      "red",
      "AIKIDO: You are using tsx to run your code. Zen might not fully work when using tsx. In production you should always use node to run your code."
    )
  );
}

function isTsxUsed() {
  return process.execArgv.some((arg) => arg.includes("tsx"));
}
