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
