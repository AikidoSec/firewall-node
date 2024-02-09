import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import { Agent } from "./Agent";
import { runWithContext } from "./Context";
import { parse } from "./parseCookies";

function isObject(value: unknown): boolean {
  return (
    value !== null && (typeof value === "object" || typeof value === "function")
  );
}

function isPromise<T>(value: any): value is Promise<T> {
  return (
    value instanceof Promise ||
    (isObject(value) &&
      typeof value.then === "function" &&
      typeof value.catch === "function")
  );
}

// https://www.npmjs.com/package/aws-lambda-consumer
type SyncHandler<T extends Handler> = (
  event: Parameters<T>[0],
  context: Parameters<T>[1],
  callback: Parameters<T>[2]
) => void;

type AsyncHandler<T extends Handler> = (
  event: Parameters<T>[0],
  context: Parameters<T>[1]
) => Promise<NonNullable<Parameters<Parameters<T>[2]>[1]>>;

export function createLambdaWrapper<
  TEvent extends APIGatewayProxyEvent,
  TResult extends APIGatewayProxyResult,
>(aikido: Agent, handler: Handler<TEvent, TResult>): Handler<TEvent, TResult> {
  // AWSLambda is like Express. It makes a distinction about handlers based on its last argument
  // async (event) => async handler
  // async (event, context) => async handler
  // (event, context, callback) => sync handler
  // Nevertheless whatever option is chosen by user, we convert it to async handler.
  const asyncHandler: AsyncHandler<typeof handler> =
    handler.length > 2
      ? (event, context) =>
          new Promise((resolve, reject) => {
            const rv = (handler as SyncHandler<typeof handler>)(
              event,
              context,
              (error, result) => {
                if (error === null || error === undefined) {
                  resolve(result!); // eslint-disable-line @typescript-eslint/no-non-null-assertion
                } else {
                  reject(error);
                }
              }
            ) as unknown;

            // This should never happen, but still can if someone writes a handler as
            // `async (event, context, callback) => {}`
            if (isPromise(rv)) {
              void (rv as Promise<NonNullable<TResult>>).then(resolve, reject);
            }
          })
      : (handler as AsyncHandler<typeof handler>);

  return async (event, context) => {
    return runWithContext(
      {
        url: undefined,
        method: event.httpMethod,
        remoteAddress: event.requestContext?.identity?.sourceIp,
        // TODO: Safe to assume JSON? Catch error
        body: event.body ? JSON.parse(event.body) : undefined,
        headers: event.headers,
        query: event.queryStringParameters ? event.queryStringParameters : {},
        cookies: event.headers?.cookie ? parse(event.headers?.cookie) : {},
      },
      () => asyncHandler(event, context)
    );
  };
}
