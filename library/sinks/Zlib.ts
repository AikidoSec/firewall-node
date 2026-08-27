import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import type { PartialWrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";

export class Zlib implements Wrapper {
  private inspectPath(args: unknown[], indexes: number[], operation: string) {
    const context = getContext();

    if (!context || !args) {
      return undefined;
    }

    for (const index of indexes) {
      const path = args[index];
      if (typeof path !== "string") {
        continue;
      }

      const result = checkContextForPathTraversal({
        filename: path,
        operation: `node:zlib.${operation}`,
        context: context,
        checkPathStart: true,
      });

      if (result) {
        return result;
      }
    }

    return undefined;
  }

  private wrapFilenameMethods(
    subject: unknown,
    methods: string[],
    className: string,
    pkgInfo: PartialWrapPackageInfo,
    argIndexes: number[] = [0]
  ) {
    for (const method of methods) {
      wrapExport(subject, method, pkgInfo, {
        kind: "fs_op",
        inspectArgs: (args) =>
          this.inspectPath(args, argIndexes, `${className}.${method}`),
      });
    }
  }

  wrap(hooks: Hooks): void {
    hooks.addBuiltinModule("zlib").onRequire((exports, pkgInfo) => {
      if (exports.ZipFile) {
        this.wrapFilenameMethods(
          exports.ZipFile,
          ["open", "openSync"],
          "ZipFile",
          pkgInfo
        );

        // The methods are defined one level up the prototype chain
        // from the publicly exported ZipFile.prototype
        const internalZipFilePrototype = Object.getPrototypeOf(
          exports.ZipFile.prototype
        );
        this.wrapFilenameMethods(
          internalZipFilePrototype,
          ["add", "addSync"],
          "ZipFile",
          pkgInfo
        );
      }

      if (exports.ZipBuffer) {
        this.wrapFilenameMethods(
          exports.ZipBuffer.prototype,
          ["add", "addSync"],
          "ZipBuffer",
          pkgInfo
        );
      }

      if (exports.ZipEntry) {
        this.wrapFilenameMethods(
          exports.ZipEntry,
          ["create", "createSync", "createStream"],
          "ZipEntry",
          pkgInfo
        );

        this.wrapFilenameMethods(
          exports.ZipEntry,
          ["createSymlink"],
          "ZipEntry",
          pkgInfo,
          [0, 1] // The first two arguments are paths
        );
      }
    });
  }
}
