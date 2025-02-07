import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { wrapEvents } from "./sax/wrapEvents";
import { isXmlInContext } from "./xml/isXmlInContext";

/**
 * Wrapper for sax xml parser.
 */
export class Sax implements Wrapper {
  private inspectWrite(args: unknown[], subject: unknown) {
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

    // Check if the XML string is in the request context (also if it's only part of a larger document)
    if (!isXmlInContext(xmlPartStr, context, true)) {
      // If write is called a second time with xml that is not in the body, we won't add it to the context.
      // It's safer to store this state in the parser object instead of globally, because there could be multiple parsers at the same time.
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
      .onRequire((exports, pkgInfo) => {
        wrapExport(exports.SAXParser.prototype, "write", pkgInfo, {
          inspectArgs: (args, agent, subject) => {
            this.inspectWrite(args, subject);
          },
        });
      });
  }
}
