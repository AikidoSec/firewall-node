/*
 * Largely based on parseHeaders function from nodejs/unici
 * MIT License
 * Copyright (c) Matteo Collina and Undici contributors
 * https://github.com/nodejs/undici
 */

export function parseHeaders(
  headers: (string | Buffer | Buffer[])[],
  obj?: Record<string, string | string[]>
) {
  if (obj === undefined) obj = {};
  for (let i = 0; i < headers.length; i += 2) {
    const key = headerNameToString(headers[i]);
    let val = obj[key];

    if (val !== undefined && Object.hasOwn(obj, key)) {
      if (typeof val === "string") {
        val = [val];
        obj[key] = val;
      }
      val.push(headers[i + 1].toString("utf8"));
    } else {
      const headersValue = headers[i + 1];
      const value =
        typeof headersValue === "string"
          ? headersValue
          : Array.isArray(headersValue)
            ? headersValue.map((header) => header.toString("utf8"))
            : headersValue.toString("utf8");

      if (key === "__proto__") {
        Object.defineProperty(obj, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      } else {
        obj[key] = value;
      }
    }
  }

  // See https://github.com/nodejs/node/pull/46528
  if ("content-length" in obj && "content-disposition" in obj) {
    obj["content-disposition"] = Buffer.from(
      // @ts-expect-error Ignore
      obj["content-disposition"]
    ).toString("latin1");
  }

  return obj;
}

function headerNameToString(value: string | Buffer | Buffer[]) {
  return typeof value === "string"
    ? value.toLowerCase()
    : value.toString("latin1").toLowerCase();
}
