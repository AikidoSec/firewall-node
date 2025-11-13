import { getContext, updateContext } from "../../agent/Context";
import { formDataToPlainObject } from "../../helpers/formDataToPlainObject";
import { createWrappedFunction, isWrapped } from "../../helpers/wrap";

/**
 * Wrap the Request object's body parsing methods to update the context with the parsed body
 * when any of the methods are called.
 * This is needed because React Router uses the Fetch API Request object which has a stream
 * body that can only be consumed once. We wrap the parsing methods to capture the result.
 */
export function wrapRequestBodyParsing(request: Request) {
  request.formData = wrapBodyParsingFunction(request.formData);
  request.json = wrapBodyParsingFunction(request.json);
  request.text = wrapBodyParsingFunction(request.text);
}

function wrapBodyParsingFunction<T extends Function>(func: T) {
  if (isWrapped(func)) {
    return func;
  }

  return createWrappedFunction(func, function parse(parser) {
    return async function wrap() {
      // @ts-expect-error No type for arguments
      // eslint-disable-next-line prefer-rest-params
      const returnValue = await parser.apply(this, arguments);

      if (returnValue) {
        const context = getContext();
        if (context) {
          if (returnValue instanceof FormData) {
            updateContext(context, "body", formDataToPlainObject(returnValue));
          } else {
            updateContext(context, "body", returnValue);
          }
        }
      }

      return returnValue;
    };
  }) as T;
}
