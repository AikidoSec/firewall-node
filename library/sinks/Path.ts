import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";

export class Path implements Wrapper {
  private inspectPath(args: unknown[], operation: string) {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    for (const path of args) {
      if (typeof path === "string") {
        const result = checkContextForPathTraversal({
          filename: path,
          operation: `path.${operation}`,
          context: context,
          /* Only check the first arg for absolute path traversal.
             If an insecure absolute path is passed as the second argument,
             it can not be an absolute path because it is not the start of the resulting path. */
          checkPathStart: path === args[0],
        });

        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  wrap(hooks: Hooks): void {
    hooks
      .addBuiltinModule("path")
      .addSubject((exports) => exports)
      .inspect("join", (args) => this.inspectPath(args, "join"))
      .inspect("resolve", (args) => this.inspectPath(args, "resolve"))
      .inspect("normalize", (args) => this.inspectPath(args, "normalize"));
  }
}
