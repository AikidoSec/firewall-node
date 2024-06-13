export function isNextjs() {
  return (
    typeof process.env.NEXT_RUNTIME === "string" ||
    typeof process.env.__NEXT_PRIVATE_STANDALONE_CONFIG !== "undefined"
  );
}
