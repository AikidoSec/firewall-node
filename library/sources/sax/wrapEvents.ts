import { Context, updateContext } from "../../agent/Context";
import { wrap, isFunctionWrapped } from "../../helpers/wrap";

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
    if (
      typeof eventFunction === "function" &&
      !isFunctionWrapped(eventFunction)
    ) {
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
          addToContext(Array.from(arguments), context);
          return result;
        };
      });
    }
  }
}

/**
 * Modify the context with the parsed xml
 */
function addToContext(args: unknown[], context: Context) {
  let xmlContext: unknown[] = [];
  if (context.xml) {
    if (Array.isArray(context.xml)) {
      xmlContext = context.xml;
    } else {
      xmlContext = [context.xml];
    }
  }
  if (args.length > 0) {
    if (args.length === 1) {
      xmlContext.push(args[0]);
    } else {
      xmlContext.push(args);
    }
    updateContext(context, "xml", xmlContext);
  }
}
