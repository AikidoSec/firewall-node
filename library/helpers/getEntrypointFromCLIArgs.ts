import { isAbsolute, resolve } from "path";

/**
 * Determins the absolute path to the entrypoint of the application by parsing the CLI arguments passed to the process.
 */
export function getEntrypointFromCLIArgs(): string | undefined {
  const argv = process.argv;
  if (argv.length < 2) {
    return undefined;
  }

  let candidate = argv[1];

  if (candidate === "inspect" || candidate === "debug") {
    if (argv.length < 3) {
      return undefined;
    }
    candidate = argv[2];
  }

  if (!candidate || candidate === "-" || candidate.startsWith("-")) {
    return undefined;
  }

  return isAbsolute(candidate) ? candidate : resolve(candidate);
}
