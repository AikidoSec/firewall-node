import type { Context } from "hono";
import { getContext, updateContext } from "../../agent/Context";
import { createWrappedFunction, isWrapped } from "../../helpers/wrap";

// Wrap the request body parsing functions to update the context with the parsed body, if any of the functions are called.
export function wrapRequestBodyParsing(req: Context["req"]) {
  req.parseBody = wrapBodyParsingFunction(req.parseBody);
  req.json = wrapBodyParsingFunction(req.json);
  req.text = wrapBodyParsingFunction(req.text);
}

function wrapBodyParsingFunction<T extends Function>(func: T) {
  if (isWrapped(func)) {
    return func;
  }

  return createWrappedFunction(func, function parse(parser) {
    return async function wrap() {
      // @ts-expect-error No type for arguments
      const returnValue = await parser.apply(this, arguments);

      if (returnValue) {
        const context = getContext();
        if (context) {
          updateContext(context, "body", returnValue);
        }
      }

      return returnValue;
    };
  }) as T;
}
