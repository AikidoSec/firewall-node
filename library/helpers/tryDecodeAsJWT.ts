/**
 * This function tries to decode your input as if it is a JSON Web Token, if it fails to do so it returns {jwt: false}.
 * @param jwt A (possible) JWT
 * @returns The JWT if it's valid, otherwise it returns false
 * @example
 * tryDecodeAsJWT("invalid"); // Returns {jwt: false}
 */
export function tryDecodeAsJWT(
  jwt: string
): { jwt: true; object: unknown } | { jwt: false } {
  // The minimum JWT length is 26 characters
  // See https://datatracker.ietf.org/doc/html/rfc7519#section-6.1
  if (jwt.length < 26 || !jwt.includes(".")) {
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
  } catch {
    return {
      jwt: false,
    };
  }
}
