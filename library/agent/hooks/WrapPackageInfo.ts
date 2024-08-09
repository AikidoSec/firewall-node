export type WrapPackageInfo = {
  /**
   * Name of the package.
   */
  name: string;
  /**
   * Version of the package, only set if the module is not a builtin module.
   */
  version?: string;
  /**
   * If the module is a internal Node.js module.
   */
  isBuiltin: boolean;
  /**
   * Only set if the module is not a builtin module.
   */
  path?: {
    base: string;
    /**
     * Path of the imported js file relative to the module base directory.
     */
    relative: string;
  };
};
