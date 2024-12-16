/**
 * Removes the "node:" prefix from the id of a builtin module.
 */
export function removeNodePrefix(id: string) {
  if (id.startsWith("node:")) {
    return id.slice(5);
  }
  return id;
}
