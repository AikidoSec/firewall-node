// Detect at runtime if the library is being shipped to a browser environment
export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}
