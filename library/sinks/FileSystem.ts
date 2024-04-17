import { Context } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";

const functionsWithPath = [
  "access",
  "appendFile",
  "chmod",
  "chown",
  "createReadStream",
  "createWriteStream",
  "exists",
  "lchmod",
  "lchown",
  "lutimes",
  "lstat",
  "mkdir",
  "open",
  "openAsBlob",
  "opendir",
  "readdir",
  "readFile",
  "readlink",
  "unlink",
  "realpath",
  "rename",
  "rmdir",
  "rm",
  "stat",
  "statfs",
  "truncate",
  "utimes",
  "writeFile",
  "copyFile",
  "cp",
];

const noSync = ["createReadStream", "createWriteStream", "openAsBlob"];

const noPromise = [
  "createReadStream",
  "createWriteStream",
  "exists",
  "openAsBlob",
];

const withSecondPathArgument = ["copyFile", "cp", "link", "rename", "symlink"];

export class FileSystem implements Wrapper {
  private inspectPath(
    args: unknown[],
    name: string,
    context: Context,
    amountOfPathArgs: number
  ): InterceptorResult {
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
      }
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    const callbackStyle = hooks
      .addBuiltinModule("fs")
      .addSubject((exports) => exports);

    functionsWithPath.forEach((name) => {
      callbackStyle.inspect(name, (args, subject, agent, context) => {
        return this.inspectPath(
          args,
          name,
          context,
          withSecondPathArgument.includes(name) ? 2 : 1
        );
      });
    });

    functionsWithPath
      .filter((name) => !noSync.includes(name))
      .forEach((name) => {
        const syncName = `${name}Sync`;
        callbackStyle.inspect(syncName, (args, subject, agent, context) => {
          return this.inspectPath(
            args,
            syncName,
            context,
            withSecondPathArgument.includes(name) ? 2 : 1
          );
        });
      });

    const promiseStyle = hooks
      .addBuiltinModule("fs/promises")
      .addSubject((exports) => exports);

    functionsWithPath
      .filter((name) => !noPromise.includes(name))
      .forEach((name) => {
        promiseStyle.inspect(name, (args, subject, agent, context) => {
          return this.inspectPath(
            args,
            name,
            context,
            withSecondPathArgument.includes(name) ? 2 : 1
          );
        });
      });
  }
}
