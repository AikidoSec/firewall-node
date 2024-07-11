import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";

export class UrlSink implements Wrapper {
  private inspectUrl(args: unknown[]): InterceptorResult {
    const context = getContext();

    if (!context || args.length < 1) {
      return undefined;
    }

    let url: string;
    if (typeof args[0] === "string") {
      url = args[0];
    } else if (args[0] instanceof URL) {
      url = args[0].toString();
    } else {
      return undefined;
    }

    if (args.length > 1) {
      if (typeof args[1] === "string") {
        url = args[1] + url;
      } else if (args[1] instanceof URL) {
        url = args[1].toString() + url;
      }
    }

    if (url.startsWith("file:")) {
      // Remove the file:// prefix
      const filename = url.startsWith("file://")
        ? url.slice(7)
        : url.startsWith("file:/")
          ? url.slice(6)
          : url.slice(5);

      const result = checkContextForPathTraversal({
        filename,
        operation: `new URL`,
        context: context,
      });
      if (result) {
        return result;
      }
    }

    return undefined;
  }
  wrap(hooks: Hooks) {
    hooks.addGlobal("URL").inspectNewInstance((args) => {
      return this.inspectUrl(args);
    });
  }
}
