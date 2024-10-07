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
   * Type of the wrap target.
   */
  type: "builtin" | "external" | "global";
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
