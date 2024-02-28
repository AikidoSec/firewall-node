/**
 * It gets the options for an Agent
 * @param partialOptions Your own values which will overwrite the default options
 * @returns Options which you can then pass onto the Agent
 */
export function getOptions(partialOptions?: Partial<Options>): Options {
  const options = { ...defaultOptions, ...partialOptions };
  options.block = shouldBlock();

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
 * Should we block attacks? This is determined by the environment variable AIKIDO_NO_BLOCKING
 */
function shouldBlock(): boolean {
  if (
    process.env.AIKIDO_NO_BLOCKING === "true" ||
    process.env.AIKIDO_NO_BLOCKING === "1"
  ) {
    return false;
  }

  return true;
}
