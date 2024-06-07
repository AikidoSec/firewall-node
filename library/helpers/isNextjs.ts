export function isNextjs() {
  return typeof process.env.NEXT_RUNTIME === "string";
}
