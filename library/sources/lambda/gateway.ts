import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { isJsonContentType } from "../../helpers/isJsonContentType";
import { isPlainObject } from "../../helpers/isPlainObject";
import { tryParseJSON } from "../../helpers/tryParseJSON";
import { parse as parseCookies } from "../../helpers/parseCookies";
import { isTrustedProxyRequest } from "../../helpers/trustProxy";

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
  const headers = event.headers ? normalizeHeaders(event.headers) : {};

  if (!event.body || !isJsonContentType(headers["content-type"] || "")) {
    return undefined;
  }

  return tryParseJSON(event.body);
}

export function getContextForGatewayEvent(
  event: APIGatewayProxyEvent
): Context | undefined {
  if (isGatewayEventV1(event)) {
    const rawIp = event.requestContext?.identity?.sourceIp;
    return {
      url: getUrlFromGatewayEvent(event),
      method: event.httpMethod,
      remoteAddress: rawIp,
      isBehindTrustedProxy: isTrustedProxyRequest(rawIp),
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
    const rawIp = event.requestContext?.http?.sourceIp;

    return {
      url: url,
      method: event.requestContext?.http?.method,
      remoteAddress: rawIp,
      isBehindTrustedProxy: isTrustedProxyRequest(rawIp),
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
