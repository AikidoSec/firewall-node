import * as mod from "module";

/**
 * Check if executed in CommonJS environment.
 * This will always be true if the library is normally used because it is a CommonJS library.
 */
export function isCJS(): boolean {
  return mod.prototype !== undefined && mod.prototype.require !== undefined;
}
