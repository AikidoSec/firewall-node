import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
  Handler,
  SQSEvent,
} from "aws-lambda";
import { runWithContext } from "../agent/Context";
import { isPlainObject } from "../helpers/isPlainObject";
import { parse } from "../helpers/parseCookies";

type CallbackHandler<TEvent, TResult> = (
  event: TEvent,
  context: Context,
  callback: Callback<TResult>
) => void;

type AsyncHandler<TEvent, TResult> = (
  event: TEvent,
  context: Context
) => Promise<TResult>;

type AsyncOrCallbackHandler<TEvent, TResult> =
  | AsyncHandler<TEvent, TResult>
  | CallbackHandler<TEvent, TResult>;

function isAsyncHandler<TEvent, TResult>(
  handler: AsyncOrCallbackHandler<TEvent, TResult>
): handler is AsyncHandler<TEvent, TResult> {
  return handler.length <= 2;
}

function convertToAsyncFunction<TEvent, TResult>(
  originalHandler: AsyncOrCallbackHandler<TEvent, TResult>
): AsyncHandler<TEvent, TResult> {
  return async (event: TEvent, context: Context): Promise<TResult> => {
    if (isAsyncHandler(originalHandler)) {
      return originalHandler(event, context);
    }

    return new Promise<TResult>((resolve, reject) => {
      try {
        originalHandler(event, context, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result!);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  };
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

  try {
    return JSON.parse(event.body);
  } catch {
    return undefined;
  }
}

const jsonContentTypes = [
  "application/json",
  "application/vnd.api+json",
  "application/csp-report",
  "application/x-json",
];

function isJsonContentType(contentType: string) {
  return jsonContentTypes.some((type) => contentType.includes(type));
}

function isProxyEvent(event: unknown): event is APIGatewayProxyEvent {
  return isPlainObject(event) && "httpMethod" in event && "headers" in event;
}

function isSQSEvent(event: unknown): event is SQSEvent {
  return isPlainObject(event) && "Records" in event;
}

export function createLambdaWrapper<
  TEvent extends APIGatewayProxyEvent,
  TResult extends APIGatewayProxyResult,
>(handler: AsyncOrCallbackHandler<TEvent, TResult>): Handler<TEvent, TResult> {
  const asyncHandler = convertToAsyncFunction(handler);

  return async (event, context) => {
    if (isSQSEvent(event)) {
      return runWithContext(
        {
          url: undefined,
          method: undefined,
          remoteAddress: undefined,
          body: event.Records, // TODO DECODE SQS RECORDS
          headers: {},
          query: {},
          cookies: {},
        },
        async () => {
          return await asyncHandler(event, context);
        }
      );
    }

    if (isProxyEvent(event)) {
      return runWithContext(
        {
          url: undefined,
          method: event.httpMethod,
          remoteAddress: event.requestContext?.identity?.sourceIp,
          body: parseBody(event),
          headers: event.headers,
          query: event.queryStringParameters ? event.queryStringParameters : {},
          cookies: event.headers?.cookie ? parse(event.headers?.cookie) : {},
        },
        async () => {
          return await asyncHandler(event, context);
        }
      );
    }

    return await asyncHandler(event, context);
  };
}
