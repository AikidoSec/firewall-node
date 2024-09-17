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
const commonApiKeyHeaderNames = [
  "x-api-key",
  "api-key",
  "apikey",
  "x-token",
  "token",
];

const commonAuthCookieNames = [
  "auth",
  "session",
  "jwt",
  "token",
  "sid",
  "auth_token",
  "access_token",
  "refresh_token",
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

    if (typeof type === "string" && typeof value === "string") {
      if (isHTTPAuthScheme(type)) {
        return { type: "http", scheme: type };
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

  for (const header of commonApiKeyHeaderNames) {
    if (context.headers[header]) {
      result.push({ type: "apiKey", in: "header", name: header });
    }
  }

  if (
    context.cookies &&
    typeof context.cookies === "object" &&
    !Array.isArray(context.cookies) &&
    Object.keys(context.cookies).length > 0
  ) {
    const relevantCookies = Object.keys(context.cookies).filter((cookieName) =>
      commonAuthCookieNames.includes(cookieName.toLowerCase())
    );
    for (const cookie of relevantCookies) {
      result.push({ type: "apiKey", in: "cookie", name: cookie });
    }
  }

  return result;
}
