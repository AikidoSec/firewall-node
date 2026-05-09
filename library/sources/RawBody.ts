import { getContext, updateContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";

/**
 * This helps detect attacks in frameworks that parse the body lazily inside handlers
 * rather than using middleware before the handler is invoked.
 *
 * Note: We only support promise-based usage of raw-body, callbacks are not supported yet.
 */
export class RawBody implements Wrapper {
  private looksLikeJson(str: string): boolean {
    return str.includes('"');
  }

  private tryUpdateContextBody(buffer: unknown) {
    if (!(buffer instanceof Buffer)) {
      return;
    }

    const context = getContext();
    if (!context) {
      return;
    }

    const str = new TextDecoder("utf-8").decode(buffer);

    if (!this.looksLikeJson(str)) {
      return;
    }

    try {
      const parsed = JSON.parse(str);
      // We expect the body to be read once per request, so it's fine to overwrite it
      updateContext(context, "rawBody", parsed);
    } catch {
      // Not valid JSON, ignore
    }
  }

  private onBodyParsed(_: unknown[], returnValue: unknown) {
    if (returnValue instanceof Promise) {
      // Update context after the promise resolves, it won't change the original promise
      returnValue
        .then((buffer: Buffer) => {
          this.tryUpdateContextBody(buffer);
        })
        .catch(() => {
          // Ignore errors
        });
    }

    return returnValue;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("raw-body")
      .withVersion("^2.0.0 || ^3.0.0")
      .onRequire((exports, pkgInfo) => {
        return wrapExport(exports, undefined, pkgInfo, {
          kind: undefined,
          modifyReturnValue: (args, returnValue) => {
            return this.onBodyParsed(args, returnValue);
          },
        });
      })
      .addFileInstrumentation({
        path: "index.js",
        functions: [
          {
            nodeType: "FunctionDeclaration",
            name: "getRawBody",
            operationKind: undefined,
            modifyReturnValue: (args, returnValue) => {
              return this.onBodyParsed(args, returnValue);
            },
          },
        ],
      });
  }
}
