import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { isJsonContentType } from "../../helpers/isJsonContentType";
import { isPlainObject } from "../../helpers/isPlainObject";
import { tryParseJSON } from "../../helpers/tryParseJSON";
import { parse as parseCookies } from "../../helpers/parseCookies";

// Based on https://docs.aws.amazon.com/powertools/typescript/2.30.1/api/variables/_aws-lambda-powertools_parser.schemas.APIGatewayProxyEventSchema.html
export type APIGatewayProxyEventV1 = {
  resource: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
  path: string;
  requestContext?: {
    identity?: {
      sourceIp?: string;
    };
  };
  body?: string;
  isBase64Encoded?: boolean;
};

// Based on https://docs.aws.amazon.com/powertools/typescript/2.34.0/api/variables/_aws-lambda-powertools_parser.schemas.APIGatewayProxyEventV2Schema.html
export type APIGatewayProxyEventV2 = {
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
  rawPath: string;
  rawQueryString: string;
  requestContext: {
    http?: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
  };
  body?: string;
  isBase64Encoded?: boolean;
  cookies?: string[];
};

export type APIGatewayProxyEvent =
  | APIGatewayProxyEventV1
  | APIGatewayProxyEventV2;

export function isGatewayEvent(event: unknown): event is APIGatewayProxyEvent {
  if (!isPlainObject(event)) {
    return false;
  }
  return isGatewayEventV1(event) || isGatewayEventV2(event);
}

export function isGatewayEventV1(
  event: Record<string, unknown>
): event is APIGatewayProxyEventV1 {
  return "httpMethod" in event && "headers" in event;
}

export function isGatewayEventV2(
  event: Record<string, unknown>
): event is APIGatewayProxyEventV2 {
  return "requestContext" in event && "headers" in event;
}

export function getUrlFromGatewayEvent(
  event: APIGatewayProxyEvent
): string | undefined {
  const queryString = getQueryStringFromGatewayEvent(event);

  const path = "rawPath" in event ? event.rawPath : event.path;
  if (path === undefined) {
    return undefined;
  }

  if (queryString) {
    return `${path}?${queryString}`;
  }

  return path;
}

export function getQueryStringFromGatewayEvent(
  event: APIGatewayProxyEvent
): string | undefined {
  if ("rawQueryString" in event && event.rawQueryString) {
    return event.rawQueryString;
  }

  const query = event.queryStringParameters || {};
  const queryString = Object.keys(query)
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(query[key] || "")}`
    )
    .join("&");

  if (queryString) {
    return queryString;
  }

  return undefined;
}

function normalizeHeaders(headers: Record<string, string | undefined>) {
  const normalized: Record<string, string | undefined> = {};
  for (const key in headers) {
    normalized[key.toLowerCase()] = headers[key];
  }

  return normalized;
}

function parseBody(event: APIGatewayProxyEvent) {
  if (!event.body) {
    return undefined;
  }

  // Decode base64-encoded bodies
  let bodyString = event.body;
  if (event.isBase64Encoded) {
    try {
      bodyString = Buffer.from(event.body, "base64").toString("utf-8");
    } catch {
      // If decoding fails, use the original body string
      bodyString = event.body;
    }
  }

  const headers = event.headers ? normalizeHeaders(event.headers) : {};

  // If the content type is JSON, try to parse it
  if (isJsonContentType(headers["content-type"] || "")) {
    const parsed = tryParseJSON(bodyString);
    // If parsing succeeds, return the parsed object
    // If parsing fails, return the raw string so it's still in context
    return parsed !== undefined ? parsed : bodyString;
  }

  // For non-JSON content types, always return the body string
  // This ensures all body data is available for contextual checks
  return bodyString;
}

export function getContextForGatewayEvent(
  event: APIGatewayProxyEvent
): Context | undefined {
  if (isGatewayEventV1(event)) {
    return {
      url: getUrlFromGatewayEvent(event),
      method: event.httpMethod,
      remoteAddress: event.requestContext?.identity?.sourceIp,
      body: parseBody(event),
      headers: event.headers,
      routeParams: event.pathParameters ? event.pathParameters : {},
      query: event.queryStringParameters ? event.queryStringParameters : {},
      cookies: event.headers?.cookie ? parseCookies(event.headers.cookie) : {},
      source: "lambda/gateway",
      route: event.resource ? event.resource : undefined,
    };
  }

  if (isGatewayEventV2(event)) {
    const url = getUrlFromGatewayEvent(event);

    return {
      url: url,
      method: event.requestContext?.http?.method,
      remoteAddress: event.requestContext?.http?.sourceIp,
      body: parseBody(event),
      headers: event.headers,
      routeParams: event.pathParameters ? event.pathParameters : {},
      query: event.queryStringParameters ? event.queryStringParameters : {},
      cookies: parseCookiesFromV2Event(event),
      source: "lambda/gateway",
      route: url ? buildRouteFromURL(url) : undefined,
    };
  }
}

function parseCookiesFromV2Event(
  event: APIGatewayProxyEventV2
): Record<string, string> {
  if (event.headers?.cookie) {
    // For direct function invocations without a Gateway this header is set
    return parseCookies(event.headers.cookie);
  }

  const cookies: Record<string, string> = Object.create(null);
  if (event.cookies) {
    // This is required because the cookie header is removed in v2 Events behind a API Gateway
    // For direct function invocations this is also set, but has a different format
    // That's why the header is still preferred over this property
    for (const cookie of event.cookies) {
      const parsedCookies = parseCookies(cookie);
      Object.assign(cookies, parsedCookies);
    }
  }

  return cookies;
}
