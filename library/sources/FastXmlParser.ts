import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { addXmlToContext } from "./xml/addXmlToContext";
import { isXmlInContext } from "./xml/isXmlInContext";

/**
 * Wrapper for fast-xml-parser package.
 * If the XML string is in the body of the request and parsed with fast-xml-parser, the parsed result is stored in the context.
 * This prevents bypassing the firewall using XML. The XML is parsed only once keeping the performance impact low.
 */
export class FastXmlParser implements Wrapper {
  private inspectParse(args: unknown[], result: unknown) {
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

    // Add the parsed XML to the context
    if (result && isPlainObject(result)) {
      addXmlToContext(result, context);
    }
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("fast-xml-parser")
      .withVersion("^4.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapNewInstance(exports, "XMLParser", pkgInfo, (instance) => {
          wrapExport(instance, "parse", pkgInfo, {
            modifyReturnValue: (args, returnValue) => {
              this.inspectParse(args, returnValue);
              return returnValue;
            },
          });
        });
      });
  }
}
