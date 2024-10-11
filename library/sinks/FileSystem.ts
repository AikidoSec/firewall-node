import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { getSemverNodeVersion } from "../helpers/getNodeVersion";
import { isVersionGreaterOrEqual } from "../helpers/isVersionGreaterOrEqual";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";

type FileSystemFunction = {
  pathsArgs: number; // The amount of arguments that are paths
  sync: boolean; // Whether the function has a synchronous version (e.g. fs.accessSync)
  promise: boolean; // Whether the function has a promise version (e.g. fs.promises.access)
};

export class FileSystem implements Wrapper {
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
      appendFile: { pathsArgs: 1, sync: true, promise: true },
      chmod: { pathsArgs: 1, sync: true, promise: true },
      chown: { pathsArgs: 1, sync: true, promise: true },
      createReadStream: { pathsArgs: 1, sync: false, promise: false },
      createWriteStream: { pathsArgs: 1, sync: false, promise: false },
      lchown: { pathsArgs: 1, sync: true, promise: true },
      lutimes: { pathsArgs: 1, sync: true, promise: true },
      mkdir: { pathsArgs: 1, sync: true, promise: true },
      open: { pathsArgs: 1, sync: true, promise: true },
      opendir: { pathsArgs: 1, sync: true, promise: true },
      readdir: { pathsArgs: 1, sync: true, promise: true },
      readFile: { pathsArgs: 1, sync: true, promise: true },
      readlink: { pathsArgs: 1, sync: true, promise: true },
      unlink: { pathsArgs: 1, sync: true, promise: true },
      realpath: { pathsArgs: 1, sync: true, promise: true },
      rename: { pathsArgs: 2, sync: true, promise: true },
      rmdir: { pathsArgs: 1, sync: true, promise: true },
      rm: { pathsArgs: 1, sync: true, promise: true },
      symlink: { pathsArgs: 2, sync: true, promise: true },
      truncate: { pathsArgs: 1, sync: true, promise: true },
      utimes: { pathsArgs: 1, sync: true, promise: true },
      writeFile: { pathsArgs: 1, sync: true, promise: true },
      copyFile: { pathsArgs: 2, sync: true, promise: true },
      cp: { pathsArgs: 2, sync: true, promise: true },
      link: { pathsArgs: 2, sync: true, promise: true },
      watch: { pathsArgs: 1, sync: false, promise: false },
      watchFile: { pathsArgs: 1, sync: false, promise: false },
      mkdtemp: { pathsArgs: 1, sync: true, promise: true },
    };

    // Added in v19.8.0
    if (isVersionGreaterOrEqual("19.8.0", getSemverNodeVersion())) {
      functions.openAsBlob = { pathsArgs: 1, sync: false, promise: false };
    }

    // Only available on macOS
    if (process.platform === "darwin") {
      functions.lchmod = { pathsArgs: 1, sync: true, promise: true };
    }

    return functions;
  }

  wrap(hooks: Hooks) {
    // Wrap fs
    hooks.addBuiltinModule("fs").onRequire((exports, pkgInfo) => {
      const functions = this.getFunctions();

      Object.keys(functions).forEach((name) => {
        const { pathsArgs, sync, promise } = functions[name];

        wrapExport(exports, name, pkgInfo, {
          inspectArgs: (args) => {
            return this.inspectPath(args, name, pathsArgs);
          },
        });

        if (sync) {
          wrapExport(exports, `${name}Sync`, pkgInfo, {
            inspectArgs: (args) => {
              return this.inspectPath(args, `${name}Sync`, pathsArgs);
            },
          });
        }
      });

      // Wrap realpath.native
      wrapExport(exports.realpath, "native", pkgInfo, {
        inspectArgs: (args) => {
          return this.inspectPath(args, "realpath.native", 1);
        },
      });
      wrapExport(exports.realpathSync, "native", pkgInfo, {
        inspectArgs: (args) => {
          return this.inspectPath(args, "realpathSync.native", 1);
        },
      });
    });

    // Wrap fs/promises
    hooks.addBuiltinModule("fs/promises").onRequire((exports, pkgInfo) => {
      const functions = this.getFunctions();
      Object.keys(functions).forEach((name) => {
        const { pathsArgs, sync, promise } = functions[name];

        if (promise) {
          wrapExport(exports, name, pkgInfo, {
            inspectArgs: (args) => this.inspectPath(args, name, pathsArgs),
          });
        }
      });
    });
  }
}
