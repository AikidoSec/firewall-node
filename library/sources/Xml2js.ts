/* eslint-disable prefer-rest-params */
import { getContext, runWithContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";

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

    if (typeof context.body !== "string" || context.body !== xmlString) {
      // The XML string is not in the body, so currently we don't check it
      return args;
    }

    // Wrap the callback to get the parsed result
    const originalCallback = args[1] as Function;
    args[1] = function wrapCallback(err: Error, result: unknown) {
      if (result && isPlainObject(result)) {
        context.xml = result;
      }
      runWithContext(context, () => originalCallback(err, result));
    };

    return args;
  }

  wrap(hooks: Hooks) {
    const xml2js = hooks
      .addPackage("xml2js")
      .withVersion("^0.6.0 || ^0.5.0 || ^0.4.18");

    xml2js
      .addSubject((exports) => exports.Parser.prototype)
      // Also wraps parseStringPromise and usage without Parser instance
      .modifyArguments("parseString", (args) => this.modifyArgs(args));
  }
}
