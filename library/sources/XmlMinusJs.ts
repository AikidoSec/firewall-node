import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { addXmlToContext } from "./xml/addXmlToContext";
import { isXmlInContext } from "./xml/isXmlInContext";

/**
 * Wrapper for xml-js package.
 */
export class XmlMinusJs implements Wrapper {
  private inspectParse(args: unknown[], result: unknown, jsonStr: boolean) {
    if (!args.length || typeof args[0] !== "string") {
      return;
    }

    const context = getContext();
    if (!context) {
      // We expect the context to be set by the wrapped http server
      return;
    }

    const xmlString = args[0] as string;

    // Check if the XML string is in the request context
    if (!isXmlInContext(xmlString, context)) {
      return args;
    }

    const parsed = jsonStr ? JSON.parse(result as string) : result;

    // Replace the body in the context with the parsed result
    if (parsed && isPlainObject(parsed)) {
      addXmlToContext(parsed, context);
    }
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("xml-js")
      .withVersion("^1.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapExport(exports, "xml2js", pkgInfo, {
          kind: "deserialize_op",
          modifyReturnValue: (args, result) => {
            this.inspectParse(args, result, false);
            return result;
          },
        });
        wrapExport(exports, "xml2json", pkgInfo, {
          kind: "deserialize_op",
          modifyReturnValue: (args, result) => {
            this.inspectParse(args, result, true);
            return result;
          },
        });
      })
      // We don't need to wrap xml2json file with the new hook system, as it uses xml2js internally.
      .addFileInstrumentation({
        path: "lib/xml2js.js",
        functions: [
          {
            name: "module.exports",
            nodeType: "FunctionAssignment",
            operationKind: "deserialize_op",
            modifyReturnValue: (args, result) => {
              this.inspectParse(args, result, false);
              return result;
            },
          },
        ],
      });
  }
}
