import type { Context } from "../../agent/Context";
import { wrap, isWrapped } from "../../helpers/wrap";
import { addXmlToContext } from "../xml/addXmlToContext";

// Events that are emitted by the sax parser and provide any data
const eventsToWrap = [
  "text",
  "processinginstruction",
  "sgmldeclaration",
  "doctype",
  "comment",
  "opentagstart",
  "attribute",
  "opentag",
  "closetag",
  "opencdata",
  "cdata",
  "closecdata",
  "script",
  "opennamespace",
  "closenamespace",
];

/**
 * Wrap the event functions if set by the user get the parser results
 */
export function wrapEvents(
  saxParser: { [index: string]: any },
  context: Context
) {
  for (const event of eventsToWrap) {
    const eventFunctionName = `on${event}`;
    const eventFunction = saxParser[eventFunctionName];

    // Check if the event function is set by the user and not already wrapped
    if (typeof eventFunction === "function" && !isWrapped(eventFunction)) {
      // Wrap the event function to get the results
      wrap(saxParser, eventFunctionName, (original) => {
        return function wrappedEventFunction() {
          const result = original.apply(
            // @ts-expect-error We don't know the type of this
            this,
            // eslint-disable-next-line prefer-rest-params
            arguments
          );
          // If false, write was called a second time with xml that is not in the body
          if (!saxParser["_aikido_add_to_context"]) {
            return result;
          }
          // eslint-disable-next-line prefer-rest-params
          const args = Array.from(arguments);
          for (const arg of args) {
            addXmlToContext(arg, context);
          }
          return result;
        };
      });
    }
  }
}
