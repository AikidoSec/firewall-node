import { getContext, runWithContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { addXmlToContext } from "./xml/addXmlToContext";
import { isXmlInContext } from "./xml/isXmlInContext";

/**
 * Wrapper for xml2js package.
 * If the XML string is in the body of the request and parsed with xml2js, the parsed result is stored in the context.
 * This prevents bypassing the firewall using XML. The XML is parsed only once keeping the performance impact low.
 */
export class Xml2js implements Wrapper {
  private modifyArgs(args: unknown[]) {
    if (
      args.length < 2 ||
      typeof args[0] !== "string" ||
      typeof args[1] !== "function"
    ) {
      return args;
    }

    const context = getContext();
    if (!context) {
      // We expect the context to be set by the wrapped http server
      return args;
    }

    const xmlString = args[0] as string;

    // Check if the XML string is in the request context
    if (!isXmlInContext(xmlString, context)) {
      return args;
    }

    // Wrap the callback to get the parsed result
    const originalCallback = args[1] as Function;
    args[1] = function wrapCallback(err: Error, result: unknown) {
      if (result && isPlainObject(result)) {
        addXmlToContext(result, context);
      }

      runWithContext(context, () => originalCallback(err, result));
    };

    return args;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("xml2js")
      .withVersion("^0.6.0 || ^0.5.0 || ^0.4.18")
      .onRequire((exports, pkgInfo) => {
        wrapExport(exports.Parser.prototype, "parseString", pkgInfo, {
          kind: "deserialize_op",
          modifyArgs: (args) => this.modifyArgs(args),
        });
      })
      .addFileInstrumentation({
        path: "lib/parser.js",
        functions: [
          {
            name: "Parser.prototype.parseString",
            nodeType: "FunctionAssignment",
            operationKind: "deserialize_op",
            modifyArgs: (args) => this.modifyArgs(args),
          },
        ],
      });
  }
}
