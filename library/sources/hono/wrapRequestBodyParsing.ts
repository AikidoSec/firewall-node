import type { Context } from "hono";
import { getContext, updateContext } from "../../agent/Context";
import { createWrappedFunction, isWrapped } from "../../helpers/wrap";

// Wrap the request body parsing functions to update the context with the parsed body, if any of the functions are called.
export function wrapRequestBodyParsing(req: Context["req"]) {
  req.parseBody = wrapBodyParsingFunction(req.parseBody);
  req.json = wrapBodyParsingFunction(req.json);
  req.text = wrapBodyParsingFunction(req.text);
}

type FileInfo = { fieldname: string; filename: string; mimetype: string };

function extractFilesFromBody(body: unknown): FileInfo[] {
  const files: FileInfo[] = [];

  if (typeof body !== "object" || body === null) {
    return files;
  }

  for (const [key, value] of Object.entries(body)) {
    if (typeof File !== "undefined" && value instanceof File) {
      files.push({
        fieldname: key,
        filename: value.name,
        mimetype: value.type,
      });
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof File !== "undefined" && item instanceof File) {
          files.push({
            fieldname: key,
            filename: item.name,
            mimetype: item.type,
          });
        }
      }
    }
  }

  return files;
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

          const files = extractFilesFromBody(returnValue);
          if (files.length > 0) {
            updateContext(context, "files", files);
          }
        }
      }

      return returnValue;
    };
  }) as T;
}
