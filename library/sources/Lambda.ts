import type { Callback, Context, Handler } from "aws-lambda";
import { Agent } from "../agent/Agent";
import { getInstance } from "../agent/AgentSingleton";
import { runWithContext, Context as AgentContext } from "../agent/Context";
import { envToBool } from "../helpers/envToBool";
import { isJsonContentType } from "../helpers/isJsonContentType";
import { isPlainObject } from "../helpers/isPlainObject";
import { parse } from "../helpers/parseCookies";
import { shouldDiscoverRoute } from "./http-server/shouldDiscoverRoute";

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

type GatewayResponse = {
  statusCode: number;
};

function isGatewayResponse(event: unknown): event is GatewayResponse {
  return (
    isPlainObject(event) &&
    "statusCode" in event &&
    typeof event.statusCode === "number"
  );
}

export type SQSEvent = {
  Records: Array<{
    body: string;
  }>;
};

function isSQSEvent(event: unknown): event is SQSEvent {
  return isPlainObject(event) && "Records" in event;
}

export function getFlushEveryMS(): number {
  if (process.env.AIKIDO_LAMBDA_FLUSH_EVERY_MS) {
    const parsed = parseInt(process.env.AIKIDO_LAMBDA_FLUSH_EVERY_MS, 10);
    // Minimum is 1 minute
    if (!isNaN(parsed) && parsed >= 60 * 1000) {
      return parsed;
    }
  }

  return 10 * 60 * 1000; // 10 minutes
}

export function getTimeoutInMS(): number {
  if (process.env.AIKIDO_LAMBDA_TIMEOUT_MS) {
    const parsed = parseInt(process.env.AIKIDO_LAMBDA_TIMEOUT_MS, 10);
    // Minimum is 1 second
    if (!isNaN(parsed) && parsed >= 1000) {
      return parsed;
    }
  }

  return 1000; // 1 second
}

// eslint-disable-next-line max-lines-per-function
export function createLambdaWrapper(handler: Handler): Handler {
  const asyncHandler = convertToAsyncFunction(handler);
  const agent = getInstance();

  let lastFlushStatsAt: number | undefined = undefined;
  let startupEventSent = false;

  // eslint-disable-next-line max-lines-per-function
  return async (event, context) => {
    // Send startup event on first invocation
    if (agent && !startupEventSent) {
      startupEventSent = true;
      try {
        await agent.onStart(getTimeoutInMS());
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error(`Aikido: Failed to start agent: ${err.message}`);
      }
    }

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

    let result: unknown;
    try {
      result = await runWithContext(agentContext, async () => {
        return await asyncHandler(event, context);
      });

      return result;
    } finally {
      if (agent) {
        incrementStatsAndDiscoverAPISpec(agentContext, agent, event, result);

        await agent.getPendingEvents().waitUntilSent(getTimeoutInMS());

        if (
          lastFlushStatsAt === undefined ||
          lastFlushStatsAt + getFlushEveryMS() < performance.now()
        ) {
          await agent.flushStats(getTimeoutInMS());
          lastFlushStatsAt = performance.now();
        }
      }
    }
  };
}

function incrementStatsAndDiscoverAPISpec(
  agentContext: AgentContext,
  agent: Agent,
  event: unknown,
  result: unknown
) {
  if (
    agentContext.remoteAddress &&
    agent.getConfig().isBypassedIP(agentContext.remoteAddress)
  ) {
    return;
  }

  if (
    isGatewayEvent(event) &&
    isGatewayResponse(result) &&
    agentContext.route &&
    agentContext.method
  ) {
    const shouldDiscover = shouldDiscoverRoute({
      statusCode: result.statusCode,
      method: agentContext.method,
      route: agentContext.route,
    });

    if (shouldDiscover) {
      agent.onRouteExecute(agentContext);
    }
  }

  const stats = agent.getInspectionStatistics();
  stats.onRequest();
}

let loggedWarningUnsupportedTrigger = false;

function logWarningUnsupportedTrigger() {
  if (
    loggedWarningUnsupportedTrigger ||
    envToBool(process.env.AIKIDO_LAMBDA_IGNORE_UNSUPPORTED_TRIGGER_WARNING)
  ) {
    return;
  }

  // eslint-disable-next-line no-console
  console.warn(
    "Zen detected a lambda function call with an unsupported trigger. Only API Gateway and SQS triggers are currently supported."
  );

  loggedWarningUnsupportedTrigger = true;
}
