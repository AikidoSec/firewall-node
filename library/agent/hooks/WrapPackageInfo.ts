export type WrapPackageInfo =
  | {
      // Name of the builtin module
      name: string;
      type: "builtin";
    }
  | {
      // Name of the external package
      name: string;
      // Version of the external package
      version: string;
      type: "external";
      // Path information for the external package
      path: {
        base: string;
        // Path of the imported js file relative to the module base directory
        relative: string;
      };
    }
  | {
      // Name of the global
      name: string;
      type: "global";
    };

export type PartialWrapPackageInfo = {
  name: string;
  type: "builtin" | "external" | "global";
  version?: string;
};
