/**
 * Merges the given sources into a new object with a `null` prototype.
 * This prevents being vulnerable to prototype pollution attacks,
 * as the resulting object will not inherit from `Object.prototype`.
 */
export const createSafeObject = ((...sources: object[]) =>
  Object.assign(Object.create(null), ...sources)) as typeof Object.assign;
