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
  /**
   * True if the module is imported via import statement or dynamic import from a esm file.
   */
  isESMImport?: boolean;
  path?: {
    base: string;
    /**
     * Path of the imported js file relative to the module base directory.
     */
    relative: string;
  };
};
