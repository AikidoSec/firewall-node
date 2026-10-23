import { getContext, updateContext } from "../../agent/Context";
import { formDataToPlainObject } from "../../helpers/formDataToPlainObject";
import { isPlainObject } from "../../helpers/isPlainObject";

type MultipartPart = {
  name?: string;
  filename?: string;
  type?: string;
  data: Buffer;
};

export async function wrapReadBody(_args: unknown[], returnValue: unknown) {
  const context = getContext();

  if (!context) {
    return returnValue;
  }

  const body = returnValue instanceof Promise ? await returnValue : returnValue;
  if (body) {
    updateContext(context, "body", toInspectableBody(body));
  }

  return body;
}

// Zen only extracts strings, it ignores Buffers
function toInspectableBody(body: unknown): unknown {
  if (body instanceof FormData) {
    return formDataToPlainObject(body);
  }

  if (isMultipartParts(body)) {
    return multipartPartsToPlainObject(body);
  }

  return body;
}

function isMultipartParts(body: unknown): body is MultipartPart[] {
  return (
    Array.isArray(body) &&
    body.length > 0 &&
    body.every((part) => isPlainObject(part) && Buffer.isBuffer(part.data))
  );
}

function multipartPartsToPlainObject(parts: MultipartPart[]) {
  const formData = new FormData();
  for (const part of parts) {
    if (
      part.name &&
      part.filename === undefined &&
      part.type?.split(";", 1)[0].trim().toLowerCase() !==
        "application/octet-stream"
    ) {
      formData.append(part.name, part.data.toString("utf8"));
    }
  }

  return formDataToPlainObject(formData);
}
