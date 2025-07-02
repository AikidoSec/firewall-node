import { sep } from "path";

/**
 * Converts a path to a Windows path (backslashes) if the current platform is Windows.
 */
export function toWinPathIfWin(p: string) {
  if (sep === "\\") {
    return p.split("/").join(sep);
  }
  return p;
}
