import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
  Handler,
} from "aws-lambda";
import { getInstance } from "../agent/AgentSingleton";
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

function isAsyncHandler<TEvent, TResult>(
  handler: CallbackHandler<TEvent, TResult> | AsyncHandler<TEvent, TResult>
): handler is AsyncHandler<TEvent, TResult> {
  return handler.length <= 2;
}

function convertToAsyncFunction<TEvent, TResult>(
  originalHandler:
    | CallbackHandler<TEvent, TResult>
    | AsyncHandler<TEvent, TResult>
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

function parseBody(event: APIGatewayProxyEvent) {
  const isJson = event.headers
    ? isJsonContentType(event.headers["content-type"] || "")
    : false;

  if (!event.body || !isJson) {
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
  return (
    isPlainObject(event) &&
    "httpMethod" in event &&
    "requestContext" in event &&
    "headers" in event &&
    "queryStringParameters" in event
  );
}

export function createLambdaWrapper<
  TEvent extends APIGatewayProxyEvent,
  TResult extends APIGatewayProxyResult,
>(
  handler: AsyncHandler<TEvent, TResult> | CallbackHandler<TEvent, TResult>
): Handler<TEvent, TResult> {
  const asyncHandler = convertToAsyncFunction(handler);

  return async (event, context) => {
    if (!isProxyEvent(event)) {
      return await asyncHandler(event, context);
    }

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
        const response = await asyncHandler(event, context);
        getInstance()?.heartbeat();

        return response;
      }
    );
  };
}
