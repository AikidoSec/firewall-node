import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { Wrapper } from "../agent/Wrapper";
import { getSemverNodeVersion } from "../helpers/getNodeVersion";
import { isVersionGreaterOrEqual } from "../helpers/isVersionGreaterOrEqual";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";

type FileSystemFunction = {
  pathsArgs: number; // The amount of arguments that are paths
  sync: boolean; // Whether the function has a synchronous version (e.g. fs.accessSync)
  promise: boolean; // Whether the function has a promise version (e.g. fs.promises.access)
  callback: boolean; // Whether the async version accepts an error-first callback as last arg
};

export class FileSystem implements Wrapper {
  private patchedPromises = false;

  private inspectPath(
    args: unknown[],
    name: string,
    amountOfPathArgs: number
  ): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    for (const path of args.slice(0, amountOfPathArgs)) {
      if (
        typeof path === "string" ||
        path instanceof Buffer ||
        path instanceof URL
      ) {
        const result = checkContextForPathTraversal({
          filename: path,
          operation: `fs.${name}`,
          context: context,
        });

        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  private getFunctions(): Record<string, FileSystemFunction> {
    const functions: Record<string, FileSystemFunction> = {
      appendFile: { pathsArgs: 1, sync: true, promise: true, callback: true },
      chmod: { pathsArgs: 1, sync: true, promise: true, callback: true },
      chown: { pathsArgs: 1, sync: true, promise: true, callback: true },
      createReadStream: {
        pathsArgs: 1,
        sync: false,
        promise: false,
        callback: false,
      },
      createWriteStream: {
        pathsArgs: 1,
        sync: false,
        promise: false,
        callback: false,
      },
      lchown: { pathsArgs: 1, sync: true, promise: true, callback: true },
      lutimes: { pathsArgs: 1, sync: true, promise: true, callback: true },
      mkdir: { pathsArgs: 1, sync: true, promise: true, callback: true },
      open: { pathsArgs: 1, sync: true, promise: true, callback: true },
      opendir: { pathsArgs: 1, sync: true, promise: true, callback: true },
      readdir: { pathsArgs: 1, sync: true, promise: true, callback: true },
      readFile: { pathsArgs: 1, sync: true, promise: true, callback: true },
      readlink: { pathsArgs: 1, sync: true, promise: true, callback: true },
      unlink: { pathsArgs: 1, sync: true, promise: true, callback: true },
      realpath: { pathsArgs: 1, sync: true, promise: true, callback: true },
      rename: { pathsArgs: 2, sync: true, promise: true, callback: true },
      rmdir: { pathsArgs: 1, sync: true, promise: true, callback: true },
      rm: { pathsArgs: 1, sync: true, promise: true, callback: true },
      symlink: { pathsArgs: 2, sync: true, promise: true, callback: true },
      truncate: { pathsArgs: 1, sync: true, promise: true, callback: true },
      utimes: { pathsArgs: 1, sync: true, promise: true, callback: true },
      writeFile: { pathsArgs: 1, sync: true, promise: true, callback: true },
      copyFile: { pathsArgs: 2, sync: true, promise: true, callback: true },
      cp: { pathsArgs: 2, sync: true, promise: true, callback: true },
      link: { pathsArgs: 2, sync: true, promise: true, callback: true },
      watch: { pathsArgs: 1, sync: false, promise: false, callback: false },
      watchFile: { pathsArgs: 1, sync: false, promise: false, callback: false },
      mkdtemp: { pathsArgs: 1, sync: true, promise: true, callback: true },
    };

    // Added in v19.8.0
    if (isVersionGreaterOrEqual("19.8.0", getSemverNodeVersion())) {
      functions.openAsBlob = {
        pathsArgs: 1,
        sync: false,
        promise: false,
        callback: false,
      };
    }

    // Only available on macOS
    if (process.platform === "darwin") {
      functions.lchmod = {
        pathsArgs: 1,
        sync: true,
        promise: true,
        callback: true,
      };
    }

    return functions;
  }

  wrapPromises(exports: unknown, pkgInfo: WrapPackageInfo) {
    if (this.patchedPromises) {
      // `require("fs").promises.readFile` is the same as `require("fs/promises").readFile`
      // We only need to wrap the promise version once
      return;
    }

    const functions = this.getFunctions();
    Object.keys(functions).forEach((name) => {
      const { pathsArgs, promise } = functions[name];

      if (promise) {
        wrapExport(exports, name, pkgInfo, {
          kind: "fs_op",
          inspectArgs: (args) => this.inspectPath(args, name, pathsArgs),
        });
      }
    });

    this.patchedPromises = true;
  }

  wrap(hooks: Hooks) {
    hooks.addBuiltinModule("fs").onRequire((exports, pkgInfo) => {
      const functions = this.getFunctions();

      Object.keys(functions).forEach((name) => {
        const { pathsArgs, sync, callback } = functions[name];

        wrapExport(exports, name, pkgInfo, {
          kind: "fs_op",
          inspectArgs: (args) => {
            return this.inspectPath(args, name, pathsArgs);
          },
          callbackOnBlock: callback,
        });

        if (sync) {
          wrapExport(exports, `${name}Sync`, pkgInfo, {
            kind: "fs_op",
            inspectArgs: (args) => {
              return this.inspectPath(args, `${name}Sync`, pathsArgs);
            },
          });
        }
      });

      // Wrap realpath.native
      wrapExport(exports.realpath, "native", pkgInfo, {
        kind: "fs_op",
        inspectArgs: (args) => {
          return this.inspectPath(args, "realpath.native", 1);
        },
        callbackOnBlock: true,
      });

      wrapExport(exports.realpathSync, "native", pkgInfo, {
        kind: "fs_op",
        inspectArgs: (args) => {
          return this.inspectPath(args, "realpathSync.native", 1);
        },
      });

      this.wrapPromises(exports.promises, pkgInfo);
    });

    hooks
      .addBuiltinModule("fs/promises")
      .onRequire((exports, pkgInfo) => this.wrapPromises(exports, pkgInfo));
  }
}
