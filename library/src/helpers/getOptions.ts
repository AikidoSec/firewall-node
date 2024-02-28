/**
 * It gets the options for an Agent
 * @param partialOptions Your own values which will overwrite the default options
 * @returns Options which you can then pass onto the Agent
 */
export function getOptions(partialOptions?: Partial<Options>): Options {
  const options = { ...defaultOptions, ...partialOptions };

  if (dryModeEnabled()) {
    options.block = false;
  }

  return options;
}

export type Options = {
  debug: boolean;
  block: boolean;
};

const defaultOptions: Options = {
  debug: false,
  block: true,
};

/**
 * This function checks the "AIKIDO_NO_BLOCKING" environment variable, when this is set to true or 1,
 * the function returns true, otherwise the function returns false.
 */
function dryModeEnabled(): boolean {
  return (
    process.env.AIKIDO_NO_BLOCKING === "true" ||
    process.env.AIKIDO_NO_BLOCKING === "1"
  );
}
