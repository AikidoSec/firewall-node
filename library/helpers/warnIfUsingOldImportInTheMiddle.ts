import { isVersionGreaterOrEqual } from "./isVersionGreaterOrEqual";

let warnedAboutOldImportInTheMiddle = false;

export function warnIfUsingOldImportInTheMiddle(version: string): void {
  if (
    warnedAboutOldImportInTheMiddle ||
    isVersionGreaterOrEqual("3.0.2", version)
  ) {
    return;
  }

  warnedAboutOldImportInTheMiddle = true;
  // oxlint-disable-next-line no-console
  console.warn(
    `AIKIDO: import-in-the-middle@${version} may break CommonJS module loading when used with Zen's ESM instrumentation. Upgrade the monitoring agent that provides it to use import-in-the-middle >=3.0.2. See https://github.com/nodejs/import-in-the-middle/pull/250.`
  );
}
