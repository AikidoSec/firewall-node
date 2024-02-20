/**
 * Decodes the URI provided to it
 * @param str encoded URI
 * @returns decoded URI
 */
function decode(str: string): string {
  return str.indexOf("%") !== -1 ? decodeURIComponent(str) : str;
}


/**
 * Encapsulates the "decode" function with a try-catch.
 * @param str string that needs to be decoded
 * @returns Returns the decoded result or the same string if decode fails
 */
function tryDecode(str: string): string {
  try {
    return decode(str);
  } catch (e) {
    return str;
  }
}

/**
 * This function parses a cookie string from the Lambda source.
 * @param str A string containing cookies
 * @returns Object with the cookie name as a key and their value as a value
 * @example
 * parse("foo=oof;bar=rab"); // Returns {foo: "oof", bar: "rab"}
 */
export function parse(str: string) {
  const obj: Record<string, string> = {};

  let index = 0;
  while (index < str.length) {
    const eqIdx = str.indexOf("=", index);

    // no more cookie pairs
    if (eqIdx === -1) {
      break;
    }

    let endIdx = str.indexOf(";", index);

    if (endIdx === -1) {
      endIdx = str.length;
    } else if (endIdx < eqIdx) {
      // backtrack on prior semicolon
      index = str.lastIndexOf(";", eqIdx - 1) + 1;
      continue;
    }

    const key = str.slice(index, eqIdx).trim();

    // only assign once
    if (undefined === obj[key]) {
      let val = str.slice(eqIdx + 1, endIdx).trim();

      // quoted values
      if (val.charCodeAt(0) === 0x22) {
        val = val.slice(1, -1);
      }

      obj[key] = tryDecode(val);
    }

    index = endIdx + 1;
  }

  return obj;
}
