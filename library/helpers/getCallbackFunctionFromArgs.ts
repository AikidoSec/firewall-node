// Finds the last function argument in the provided array and returns it. If no function is found, it returns undefined.
export function getCallbackFunctionFromArgs(args: any[]): Function | undefined {
  for (let i = args.length - 1; i >= 0; i--) {
    if (typeof args[i] === "function") {
      return args[i] as Function;
    }
  }
  return undefined;
}
