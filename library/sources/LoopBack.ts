import { getContext, updateContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";

export class LoopBack implements Wrapper {
  private onBodyParsed(_args: unknown[], returnValue: unknown) {
    if (!(returnValue instanceof Promise)) {
      return returnValue;
    }

    returnValue
      .then((requestBody: unknown) => {
        const context = getContext();
        if (!context) {
          return;
        }

        if (
          requestBody !== null &&
          typeof requestBody === "object" &&
          "value" in requestBody
        ) {
          if (requestBody.value) {
            updateContext(context, "body", requestBody.value);
          }
        }
      })
      .catch(() => {
        // Ignore errors
      });

    return returnValue;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("@loopback/rest")
      .withVersion("^14.0.0 || ^15.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapExport(
          exports.RequestBodyParser.prototype,
          "loadRequestBodyIfNeeded",
          pkgInfo,
          {
            kind: undefined,
            modifyReturnValue: (args, returnValue) =>
              this.onBodyParsed(args, returnValue),
          }
        );
      })
      .addFileInstrumentation({
        path: "dist/body-parsers/body-parser.js",
        functions: [
          {
            name: "loadRequestBodyIfNeeded",
            nodeType: "MethodDefinition",
            operationKind: undefined,
            modifyReturnValue: (args, returnValue) =>
              this.onBodyParsed(args, returnValue),
          },
        ],
      });
  }
}
