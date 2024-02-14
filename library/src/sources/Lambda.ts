import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Callback,
  Context,
  Handler,
} from "aws-lambda";
import { getInstance } from "../agent/AgentSingleton";
import { runWithContext } from "../agent/Context";
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

export function createLambdaWrapper<
  TEvent extends APIGatewayProxyEvent,
  TResult extends APIGatewayProxyResult,
>(
  handler: AsyncHandler<TEvent, TResult> | CallbackHandler<TEvent, TResult>
): Handler<TEvent, TResult> {
  const asyncHandler = convertToAsyncFunction(handler);

  return async (event, context) => {
    return runWithContext(
      {
        url: undefined,
        method: event.httpMethod,
        remoteAddress: event.requestContext?.identity?.sourceIp,
        body: event.body ? JSON.parse(event.body) : undefined,
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
