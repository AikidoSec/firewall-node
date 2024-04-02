import { Context } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";

export class PathTraversal implements Wrapper {
  private inspectWriteFileSync(
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
    // TODO: hook on other fs operations (readFile, readFileync, readdir, readdirSync, resolve, join,...)
    const fs = hooks.addBuiltinModule("fs");

    fs
      .addSubject((exports) => exports)
      .inspect("writeFileSync", (args, subject, agent, context) =>
        this.inspectWriteFileSync(args, "writeFileSync", context)
      )
      .inspect("writeFile", (args, subject, agent, context) =>
        this.inspectWriteFileSync(args, "writeFile", context)
      );
  }
}
