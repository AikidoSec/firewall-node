/* eslint-disable prefer-rest-params */
import { getContext, updateContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
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

    // Replace the body in the context with the parsed result
    if (result && isPlainObject(result)) {
      if (Array.isArray(context.xml)) {
        updateContext(context, "xml", context.xml.concat(result));
      } else {
        updateContext(context, "xml", [result]);
      }
    }
  }

  wrap(hooks: Hooks) {
    const fastXmlParser = hooks
      .addPackage("fast-xml-parser")
      .withVersion("^4.0.0");

    fastXmlParser
      .addSubject((exports) => exports)
      .inspectNewInstance("XMLParser")
      .addSubject((exports) => exports)
      .inspectResult("parse", (args, result) =>
        this.inspectParse(args, result)
      );
  }
}
