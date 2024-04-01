import type { APIGatewayProxyHandler } from "aws-lambda";
import type { HttpFunction } from "@google-cloud/functions-framework";
import * as shimmer from "shimmer";
import { ChildProcess } from "../sinks/ChildProcess";
import { MongoDB } from "../sinks/MongoDB";
import { MySQL } from "../sinks/MySQL";
import { MySQL2 } from "../sinks/MySQL2";
import { Postgres } from "../sinks/Postgres";
import {
  createCloudFunctionWrapper,
  FunctionsFramework,
} from "../sources/FunctionsFramework";
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

function isDebugging() {
  return (
    process.env.AIKIDO_DEBUG === "true" || process.env.AIKIDO_DEBUG === "1"
  );
}

function shouldBlock() {
  return (
    process.env.AIKIDO_BLOCKING === "true" ||
    process.env.AIKIDO_BLOCKING === "1"
  );
}

function getLogger(): Logger {
  if (isDebugging()) {
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

function getAgent({ serverless }: { serverless: string | undefined }) {
  const current = getInstance();

  if (current) {
    return current;
  }

  const agent = new Agent(
    shouldBlock(),
    getLogger(),
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
    new ChildProcess(),
  ];
}

export function protect() {
  disableShimmerLogging();

  const agent = getAgent({
    serverless: undefined,
  });

  agent.start(getWrappers());
}

export function lambda(): (
  handler: APIGatewayProxyHandler
) => APIGatewayProxyHandler {
  disableShimmerLogging();

  const agent = getAgent({
    serverless: "lambda",
  });

  agent.start(getWrappers());

  return createLambdaWrapper;
}

export function cloudFunction(): (handler: HttpFunction) => HttpFunction {
  disableShimmerLogging();

  const agent = getAgent({
    serverless: "gcp",
  });

  agent.start(getWrappers());

  return createCloudFunctionWrapper;
}
