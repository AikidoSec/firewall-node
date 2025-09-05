import type { Callback, Context, Handler } from "aws-lambda";
import { getInstance } from "../agent/AgentSingleton";
import { runWithContext, Context as AgentContext } from "../agent/Context";
import { isJsonContentType } from "../helpers/isJsonContentType";
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
  // oxlint-disable-next-line require-await
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

function tryParseAsJSON(json: string) {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

function parseBody(event: APIGatewayProxyEvent) {
  const headers = event.headers ? normalizeHeaders(event.headers) : {};

  if (!event.body || !isJsonContentType(headers["content-type"] || "")) {
    return undefined;
  }

  return tryParseAsJSON(event.body);
}

export type APIGatewayProxyEvent = {
  resource: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
  requestContext?: {
    identity?: {
      sourceIp?: string;
    };
  };
  body?: string;
};

function isGatewayEvent(event: unknown): event is APIGatewayProxyEvent {
  return isPlainObject(event) && "httpMethod" in event && "headers" in event;
}

export type SQSEvent = {
  Records: Array<{
    body: string;
  }>;
};

function isSQSEvent(event: unknown): event is SQSEvent {
  return isPlainObject(event) && "Records" in event;
}

function getFlushEveryMS(): number {
  if (process.env.AIKIDO_LAMBDA_FLUSH_EVERY_MS) {
    const parsed = parseInt(process.env.AIKIDO_LAMBDA_FLUSH_EVERY_MS, 10);
    // Minimum is 1 minute
    if (!isNaN(parsed) && parsed >= 60 * 1000) {
      return parsed;
    }
  }

  return 10 * 60 * 1000; // 10 minutes
}

// eslint-disable-next-line max-lines-per-function
export function createLambdaWrapper(handler: Handler): Handler {
  const asyncHandler = convertToAsyncFunction(handler);
  const agent = getInstance();

  let lastFlushStatsAt: number | undefined = undefined;

  // eslint-disable-next-line max-lines-per-function
  return async (event, context) => {
    let agentContext: AgentContext | undefined = undefined;

    if (isSQSEvent(event)) {
      const body: unknown[] = event.Records.map((record) =>
        tryParseAsJSON(record.body)
      ).filter((body) => body);

      agentContext = {
        url: undefined,
        method: undefined,
        remoteAddress: undefined,
        body: {
          Records: body.map((record) => ({
            body: record,
          })),
        },
        routeParams: {},
        headers: {},
        query: {},
        cookies: {},
        source: "lambda/sqs",
        route: undefined,
      };
    } else if (isGatewayEvent(event)) {
      agentContext = {
        url: undefined,
        method: event.httpMethod,
        remoteAddress: event.requestContext?.identity?.sourceIp,
        body: parseBody(event),
        headers: event.headers,
        routeParams: event.pathParameters ? event.pathParameters : {},
        query: event.queryStringParameters ? event.queryStringParameters : {},
        cookies: event.headers?.cookie ? parse(event.headers.cookie) : {},
        source: "lambda/gateway",
        route: event.resource ? event.resource : undefined,
      };
    }

    if (!agentContext) {
      // We don't know what the type of the event is
      // We can't provide any context for the underlying sinks
      // So we just run the handler without any context
      logWarningUnsupportedTrigger();

      return await asyncHandler(event, context);
    }

    try {
      return await runWithContext(agentContext, async () => {
        return await asyncHandler(event, context);
      });
    } finally {
      if (agent) {
        const stats = agent.getInspectionStatistics();
        stats.onRequest();

        if (
          lastFlushStatsAt === undefined ||
          lastFlushStatsAt + getFlushEveryMS() < performance.now()
        ) {
          await agent.flushStats(1000);
          lastFlushStatsAt = performance.now();
        }
      }
    }
  };
}

let loggedWarningUnsupportedTrigger = false;

function logWarningUnsupportedTrigger() {
  if (loggedWarningUnsupportedTrigger) {
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    "Zen detected a lambda function call with an unsupported trigger. Only API Gateway and SQS triggers are currently supported."
  );

  loggedWarningUnsupportedTrigger = true;
}
