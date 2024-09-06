/* eslint-disable prefer-rest-params */
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapEvents } from "./sax/wrapEvents";

/**
 * Wrapper for sax xml parser.
 */
export class Sax implements Wrapper {
  private inspectWrite(args: unknown[], subject: unknown, agent: Agent) {
    // Ignore if no arguments are passed, parser is closed (null) or the first argument is a empty string or object
    if (!args.length || !args[0]) {
      return;
    }

    // This should not happen, but we check it for type safety and to be sure
    if (!subject || typeof subject !== "object") {
      return;
    }

    const context = getContext();
    if (!context) {
      // We expect the context to be set by the wrapped http server
      return;
    }

    // It's possible to split one xml document into multiple parts and call write() multiple times
    let xmlPartStr: string;
    // If args[0] is a object, toString() will be called
    if (typeof args[0] === "object") {
      xmlPartStr = args[0].toString();
    } else if (typeof args[0] === "string") {
      xmlPartStr = args[0];
    } else {
      // Ignore if the first argument is not a string or object
      return;
    }

    if (
      typeof context.body !== "string" ||
      !context.body.includes(xmlPartStr)
    ) {
      // If write is called a second time with xml that is not in the body, we won't add it to the context. It's safer to store this state in the parser object instead of globally.
      (subject as { [key: string]: any })["_aikido_add_to_context"] = false;
      // The XML string is not in the body, so currently we don't check it
      return;
    }
    (subject as { [key: string]: any })["_aikido_add_to_context"] = true;

    wrapEvents(subject, context);
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("sax")
      .withVersion("^1.0.0")
      .addSubject((exports) => exports.SAXParser.prototype)
      .inspect("write", this.inspectWrite);
  }
}
