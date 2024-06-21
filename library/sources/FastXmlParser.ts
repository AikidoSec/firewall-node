/* eslint-disable prefer-rest-params */
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";

/**
 * Wrapper for fast-xml-parser package.
 * If the XML string is in the body of the request and parsed with fast-xml-parser, the parsed result is stored in the context as body.
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

    if (typeof context.body !== "string" || context.body !== xmlString) {
      // The XML string is not in the body, so currently we don't check it
      return args;
    }

    // Replace the body in the context with the parsed result
    if (result && isPlainObject(result)) {
      context.body = result;
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
