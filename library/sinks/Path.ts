import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { Wrapper } from "../agent/Wrapper";
import { isWindows } from "../helpers/isWindows";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";
import type * as path from "path";

export class Path implements Wrapper {
  private patchedPosix = false;
  private patchedWin32 = false;

  private inspectPath(args: unknown[], operation: string) {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    for (let i = 0; i < args.length; i++) {
      const path = args[i];
      if (typeof path === "string") {
        const result = checkContextForPathTraversal({
          filename: path,
          operation: `path.${operation}`,
          context: context,
          // Only check the first argument for absolute paths, unless the operation is `resolve`.
          //
          // For most path operations (join, normalize), only the first argument matters
          // because subsequent absolute paths are treated as relative components.
          // However, path.resolve() is special: ANY absolute path in ANY position
          // becomes the new resolved path, discarding all previous arguments.
          //
          // Examples:
          // - path.join('/tmp', '/etc/passwd') → '/tmp/etc/passwd'
          // - path.resolve('/tmp', '/etc/passwd') → '/etc/passwd'
          checkPathStart: i === 0 || operation === "resolve",
        });

        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  private wrapFunctions(exports: unknown, pkgInfo: WrapPackageInfo) {
    const functions = ["join", "resolve", "normalize"];

    for (const func of functions) {
      wrapExport(exports, func, pkgInfo, {
        kind: "fs_op",
        inspectArgs: (args) => this.inspectPath(args, func),
      });
    }
  }

  private wrapMainModule(exports: typeof path, pkgInfo: WrapPackageInfo) {
    // If `path/win32` or `path/posix` was not required before `path`, we should wrap the functions in `path`
    if (!this.patchedWin32 && !this.patchedPosix) {
      this.wrapFunctions(exports, pkgInfo);
    }

    if (isWindows()) {
      // `require("path").join` is the same as `require("path/win32").join`
      this.patchedWin32 = true;
    } else {
      // `require("path").join` is the same as `require("path/posix").join`
      this.patchedPosix = true;
    }

    this.wrapPosix(exports.posix, pkgInfo);
    this.wrapWin32(exports.win32, pkgInfo);
  }

  private wrapPosix(exports: unknown, pkgInfo: WrapPackageInfo) {
    if (this.patchedPosix) {
      return;
    }

    this.wrapFunctions(exports, pkgInfo);

    this.patchedPosix = true;
  }

  private wrapWin32(exports: unknown, pkgInfo: WrapPackageInfo) {
    if (this.patchedWin32) {
      return;
    }

    this.wrapFunctions(exports, pkgInfo);

    this.patchedWin32 = true;
  }

  wrap(hooks: Hooks): void {
    hooks
      .addBuiltinModule("path")
      .onRequire((exports, pkgInfo) => this.wrapMainModule(exports, pkgInfo));

    hooks
      .addBuiltinModule("path/posix")
      .onRequire((exports, pkgInfo) => this.wrapPosix(exports, pkgInfo));

    hooks
      .addBuiltinModule("path/win32")
      .onRequire((exports, pkgInfo) => this.wrapWin32(exports, pkgInfo));
  }
}
