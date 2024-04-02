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
  "realpath",
  "rename",
  "rmdir",
  "rm",
  "stat",
  "statfs",
  "truncate",
  "utimes",
  "writeFile",
];

const noSync = ["createReadStream", "createWriteStream", "openAsBlob"];

const noPromise = [
  "createReadStream",
  "createWriteStream",
  "exists",
  "openAsBlob",
];

// TODO: Add support for multiple paths
const withMultiplePaths = ["readdir", "rm"];

export class PathTraversal implements Wrapper {
  private inspectPath(
    args: unknown[],
    name: string,
    context: Context
  ): InterceptorResult {
    if (args.length > 0 && typeof args[0] === "string") {
      const path = args[0];
      return checkContextForPathTraversal({
        filename: path,
        operation: `fs.${name}`,
        context: context,
      });
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    const callbackStyle = hooks
      .addBuiltinModule("fs")
      .addSubject((exports) => exports);

    functionsWithPath.forEach((name) => {
      callbackStyle.inspect(name, (args, subject, agent, context) =>
        this.inspectPath(args, name, context)
      );
    });

    functionsWithPath
      .filter((name) => !noSync.includes(name))
      .forEach((name) => {
        const syncName = `${name}Sync`;
        callbackStyle.inspect(syncName, (args, subject, agent, context) =>
          this.inspectPath(args, syncName, context)
        );
      });

    const promiseStyle = hooks
      .addBuiltinModule("fs/promises")
      .addSubject((exports) => exports);

    functionsWithPath
      .filter((name) => !noPromise.includes(name))
      .forEach((name) => {
        promiseStyle.inspect(name, (args, subject, agent, context) =>
          this.inspectPath(args, name, context)
        );
      });
  }
}
