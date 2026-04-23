import { getContext, updateContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";

export class LoopBack implements Wrapper {
  private setBodyFromRequestBody(requestBody: unknown) {
    const context = getContext();
    if (!context) {
      return;
    }
    if (requestBody === null || typeof requestBody !== "object") {
      return;
    }
    if (!("value" in requestBody) || !requestBody.value) {
      return;
    }
    updateContext(context, "body", requestBody.value);
  }

  private onBodyParsed(_args: unknown[], returnValue: unknown) {
    if (returnValue instanceof Promise) {
      returnValue
        .then((requestBody) => this.setBodyFromRequestBody(requestBody))
        .catch(() => {
          // Ignore errors
        });

      return returnValue;
    }

    this.setBodyFromRequestBody(returnValue);
    return returnValue;
  }

  private onParseOperationArgs(args: unknown[]) {
    const context = getContext();
    if (!context || args.length < 2) {
      return args;
    }

    const route = args[1];
    if (
      route !== null &&
      typeof route === "object" &&
      "pathParams" in route &&
      route.pathParams !== null &&
      typeof route.pathParams === "object"
    ) {
      updateContext(
        context,
        "routeParams",
        route.pathParams as Record<string, string>
      );
    }

    return args;
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
      .onFileRequire("dist/parser.js", (exports, pkgInfo) => {
        wrapExport(exports, "parseOperationArgs", pkgInfo, {
          kind: undefined,
          modifyArgs: (args) => this.onParseOperationArgs(args),
        });
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
      })
      .addFileInstrumentation({
        path: "dist/parser.js",
        functions: [
          {
            name: "parseOperationArgs",
            nodeType: "FunctionDeclaration",
            operationKind: undefined,
            modifyArgs: (args) => this.onParseOperationArgs(args),
          },
        ],
      });
  }
}
