import {
  HTTPAuthScheme,
  isHTTPAuthScheme,
} from "../../helpers/isHTTPAuthScheme";
import { Context } from "../Context";

// https://swagger.io/docs/specification/authentication/
export type APIAuthType = {
  // http for authorization header e.g. basic, bearer, else apiKey
  type: "http" | "apiKey";
  // Set if type is "http"
  scheme?: HTTPAuthScheme;
  in?: "header" | "cookie";
  // Name of the header or cookie if type is "apiKey"
  name?: string;
  // Optional type of the bearer token (e.g. JWT)
  bearerFormat?: string;
};

// Incoming request headers are lowercase in Node.js
const commonApiKeyHeaderNames = ["api-key", "apikey", "token"];

const commonAuthCookieNames = [
  "auth",
  "session",
  "jwt",
  "sid",
  ...commonApiKeyHeaderNames,
];

/**
 * Get the authentication type of the API request.
 * Returns undefined if the authentication type could not be determined.
 */
export function getApiAuthType(context: Context): APIAuthType[] | undefined {
  if (
    !context.headers ||
    typeof context.headers !== "object" ||
    Array.isArray(context.headers)
  ) {
    return undefined;
  }

  // Allow multiple auth types
  const result: APIAuthType[] = [];

  // Check the Authorization header
  const authHeader = context.headers.authorization;
  if (typeof authHeader === "string") {
    const authHeaderType = getAuthorizationHeaderType(authHeader);
    if (authHeaderType) {
      result.push(authHeaderType);
    }
  }

  // Check for type apiKey in headers and cookies
  result.push(...findApiKeys(context));

  return result.length > 0 ? result : undefined;
}

/**
 * Get the authentication type from the Authorization header.
 */
function getAuthorizationHeaderType(
  authHeader: string
): APIAuthType | undefined {
  if (!authHeader.length) {
    return undefined;
  }
  if (authHeader.includes(" ")) {
    const [type, value] = authHeader.split(" ");

    if (type && value) {
      if (isHTTPAuthScheme(type)) {
        return { type: "http", scheme: type.toLowerCase() as HTTPAuthScheme };
      }
    }
  }

  // Default to apiKey if the auth type is not recognized
  return { type: "apiKey", in: "header", name: "Authorization" };
}

/**
 * Search for api keys in headers and cookies.
 */
function findApiKeys(context: Context): APIAuthType[] {
  const result: APIAuthType[] = [];

  const headerNames = Object.keys(context.headers);
  for (const header of commonApiKeyHeaderNames) {
    const matches = headerNames.filter((name) =>
      name.toLowerCase().includes(header)
    );

    matches.forEach((match) => {
      const alreadyAdded = result.some(
        (authType) => authType.name === match && authType.in === "header"
      );
      if (!alreadyAdded) {
        result.push({ type: "apiKey", in: "header", name: match });
      }
    });
  }

  if (
    context.cookies &&
    typeof context.cookies === "object" &&
    !Array.isArray(context.cookies) &&
    Object.keys(context.cookies).length > 0
  ) {
    for (const cookie of commonAuthCookieNames) {
      const matches = Object.keys(context.cookies).filter((name) =>
        name.toLowerCase().includes(cookie.toLowerCase())
      );

      matches.forEach((match) => {
        const alreadyAdded = result.some(
          (authType) => authType.name === match && authType.in === "cookie"
        );
        if (!alreadyAdded) {
          result.push({ type: "apiKey", in: "cookie", name: match });
        }
      });
    }
  }

  return result;
}
