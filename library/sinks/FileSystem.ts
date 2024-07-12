import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";

type FileSystemFunction = {
  pathsArgs: number; // The amount of arguments that are paths
  sync: boolean; // Whether the function has a synchronous version (e.g. fs.accessSync)
  promise: boolean; // Whether the function has a promise version (e.g. fs.promises.access)
};

const functions: Record<string, FileSystemFunction> = {
  access: { pathsArgs: 1, sync: true, promise: true },
  appendFile: { pathsArgs: 1, sync: true, promise: true },
  chmod: { pathsArgs: 1, sync: true, promise: true },
  chown: { pathsArgs: 1, sync: true, promise: true },
  createReadStream: { pathsArgs: 1, sync: false, promise: false },
  createWriteStream: { pathsArgs: 1, sync: false, promise: false },
  exists: { pathsArgs: 1, sync: true, promise: false },
  lchmod: { pathsArgs: 1, sync: true, promise: true },
  lchown: { pathsArgs: 1, sync: true, promise: true },
  lutimes: { pathsArgs: 1, sync: true, promise: true },
  lstat: { pathsArgs: 1, sync: true, promise: true },
  mkdir: { pathsArgs: 1, sync: true, promise: true },
  open: { pathsArgs: 1, sync: true, promise: true },
  openAsBlob: { pathsArgs: 1, sync: false, promise: false },
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
  stat: { pathsArgs: 1, sync: true, promise: true },
  statfs: { pathsArgs: 1, sync: true, promise: true },
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
      if (typeof path === "string") {
        const result = checkContextForPathTraversal({
          filename: path,
          operation: `fs.${name}`,
          context: context,
        });

        if (result) {
          return result;
        }
      } else if (path instanceof URL) {
        const result = checkContextForPathTraversal({
          filename: path.pathname,
          operation: `fs.${name}`,
          context: context,
          isUrl: true,
        });

        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    const fs = hooks.addBuiltinModule("fs");
    const callbackStyle = fs.addSubject((exports) => exports);
    const promiseStyle = hooks
      .addBuiltinModule("fs/promises")
      .addSubject((exports) => exports);

    Object.keys(functions).forEach((name) => {
      const { pathsArgs, sync, promise } = functions[name];
      callbackStyle.inspect(name, (args) => {
        return this.inspectPath(args, name, pathsArgs);
      });

      if (sync) {
        callbackStyle.inspect(`${name}Sync`, (args) => {
          return this.inspectPath(args, `${name}Sync`, pathsArgs);
        });
      }

      if (promise) {
        promiseStyle.inspect(name, (args) => {
          return this.inspectPath(args, name, pathsArgs);
        });
      }
    });

    fs.addSubject((exports) => exports.realpath).inspect("native", (args) => {
      return this.inspectPath(args, "realpath.native", 1);
    });

    fs.addSubject((exports) => exports.realpathSync).inspect(
      "native",
      (args) => {
        return this.inspectPath(args, "realpathSync.native", 1);
      }
    );
  }
}
