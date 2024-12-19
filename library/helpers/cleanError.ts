import { cleanupStackTrace } from "./cleanupStackTrace";
import { getLibraryRoot } from "./getLibraryRoot";

// Cleans up the error stack trace by removing all the lines that are part of the library.
// e.g. useful to hide the module patching if we throw an error on a detected attack.
export function cleanError(err: Error) {
  if (err.stack) {
    err.stack = cleanupStackTrace(err.stack, getLibraryRoot());
  }

  return err;
}
