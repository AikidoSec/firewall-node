import type { APIGatewayProxyHandler } from "aws-lambda";
import * as shimmer from "shimmer";
import { getOptions, Options } from "../helpers/getOptions";
import { MongoDB } from "../sinks/MongoDB";
import { MySQL } from "../sinks/MySQL";
import { MySQL2 } from "../sinks/MySQL2";
import { Postgres } from "../sinks/Postgres";
import { FunctionsFramework } from "../sources/FunctionsFramework";
import { Express } from "../sources/Express";
import { createLambdaWrapper } from "../sources/Lambda";
import { PubSub } from "../sources/PubSub";
import { Agent } from "./Agent";
import { getInstance, setInstance } from "./AgentSingleton";
import { API } from "./api/API";
import { APIFetch } from "./api/APIFetch";
import { APIRateLimitedServerSide } from "./api/APIRateLimitedServerSide";
import { APIRateLimitedClientSide } from "./api/APIRateLimitedClientSide";
import { APIThatValidatesToken } from "./api/APIThatValidatesToken";
import { Token } from "./api/Token";
import { Logger } from "./logger/Logger";
import { LoggerConsole } from "./logger/LoggerConsole";
import { LoggerNoop } from "./logger/LoggerNoop";

function getLogger(options: Options): Logger {
  if (options.debug) {
    return new LoggerConsole();
  }

  return new LoggerNoop();
}

function validatesToken(api: API) {
  return new APIThatValidatesToken(api);
}

function clientSideRateLimited(api: API) {
  return new APIRateLimitedClientSide(api, {
    maxEventsPerInterval: 100,
    intervalInMs: 60 * 60 * 1000,
  });
}

function serverSideRateLimited(api: API) {
  return new APIRateLimitedServerSide(api);
}

function getAPI(): API {
  let url = new URL("https://guard.aikido.dev/api/runtime/events");
  if (process.env.AIKIDO_URL) {
    url = new URL(process.env.AIKIDO_URL);
  }

  return validatesToken(
    serverSideRateLimited(clientSideRateLimited(new APIFetch(url)))
  );
}

function getTokenFromEnv(): Token | undefined {
  return process.env.AIKIDO_TOKEN
    ? new Token(process.env.AIKIDO_TOKEN)
    : undefined;
}

function getAgent({
  options,
  serverless,
}: {
  options: Options;
  serverless: boolean;
}) {
  const current = getInstance();

  if (current) {
    return current;
  }

  const agent = new Agent(
    options.block,
    getLogger(options),
    getAPI(),
    getTokenFromEnv(),
    serverless
  );

  setInstance(agent);

  return agent;
}

/**
 * This function **disables** logging from the "shimmer" package - this avoids logs whenever a function doesn't exist
 */
function disableShimmerLogging() {
  shimmer({ logger: () => {} });
}

function getWrappers() {
  return [
    new Express(),
    new MongoDB(),
    new Postgres(),
    new MySQL(),
    new MySQL2(),
    new PubSub(),
    new FunctionsFramework(),
  ];
}

/**
 * Creates an {@link Agent} and starts it. This function is used directly by the end-user.
 * @param options Options to pass along to the protect function (See type definition)
 */
export function protect(options?: Partial<Options>) {
  disableShimmerLogging();

  const agent = getAgent({
    options: getOptions(options),
    serverless: false,
  });

  agent.start(getWrappers());
}

/**
 * Creates an {@link Agent} and starts it. This function is used directly by the end-user.
 * @param options Options to pass along to the protect function (See type definition)
 * @returns Function that allows creation of lambda wrapper
 */
export function lambda(
  options?: Partial<Options>
): (handler: APIGatewayProxyHandler) => APIGatewayProxyHandler {
  disableShimmerLogging();

  const agent = getAgent({
    options: getOptions(options),
    serverless: true,
  });

  agent.start(getWrappers());

  return createLambdaWrapper;
}
