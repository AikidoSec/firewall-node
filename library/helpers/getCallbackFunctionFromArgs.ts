// Returns the last argument if it is a function, otherwise undefined.
export function getCallbackFunctionFromArgs(args: any[]): Function | undefined {
  const last = args[args.length - 1];
  return typeof last === "function" ? last : undefined;
}
