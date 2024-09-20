/* eslint-disable prefer-rest-params */
import { getContext, updateContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
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
      if (Array.isArray(context.xml)) {
        updateContext(context, "xml", context.xml.concat(parsed));
      } else {
        updateContext(context, "xml", [parsed]);
      }
    }
  }

  wrap(hooks: Hooks) {
    const xmljs = hooks.addPackage("xml-js").withVersion("^1.0.0");

    xmljs
      .addSubject((exports) => exports)
      .inspectResult("xml2js", (args, result) => {
        this.inspectParse(args, result, false);
      })
      .inspectResult("xml2json", (args, result) => {
        this.inspectParse(args, result, true);
      });
  }
}
