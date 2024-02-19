/**
 * The JWT module only exports one function : tryDecodeAsJWT
 * @module JWT
 */

/**
 * 
 * @param jwt 
 * @returns 
 */
export function tryDecodeAsJWT(
  jwt: string
): { jwt: true; object: unknown } | { jwt: false } {
  if (!jwt.includes(".")) {
    return { jwt: false };
  }

  const parts = jwt.split(".");

  if (parts.length !== 3) {
    return { jwt: false };
  }

  try {
    return {
      jwt: true,
      object: JSON.parse(Buffer.from(parts[1], "base64").toString("utf8")),
    };
  } catch (e) {
    return {
      jwt: false,
    };
  }
}
