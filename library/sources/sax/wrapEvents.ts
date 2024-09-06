import { Context, updateContext } from "../../agent/Context";
import { wrap } from "../../helpers/wrap";
import { isFunctionWrapped } from "../../helpers/wrap";

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
 * Wrap the event functions if set by the user and not already wrapped to get thre parsed results
 */
export function wrapEvents(
  saxParser: { [index: string]: any },
  context: Context
) {
  for (const event of eventsToWrap) {
    const eventFunctionName = `on${event}`;
    const eventFunction = saxParser[eventFunctionName];
    if (
      typeof eventFunction === "function" &&
      !isFunctionWrapped(eventFunction)
    ) {
      wrap(saxParser, eventFunctionName, (original) => {
        return function wrappedEventFunction() {
          const result = original.apply(
            // @ts-expect-error We don't know the type of this
            this,
            arguments
          );
          // If false, write was called a second time with xml that is not in the body
          if (!saxParser["_aikido_add_to_context"]) {
            return result;
          }
          addToContext(Array.from(arguments), context);
          return result;
        };
      });
    }
  }
}

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
