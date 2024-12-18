import type { HttpFunction } from "@google-cloud/functions-framework";
import type { Handler } from "aws-lambda";
import { isDebugging } from "../helpers/isDebugging";
import { shouldBlock } from "../helpers/shouldBlock";
import { createCloudFunctionWrapper } from "../sources/FunctionsFramework";
import { createLambdaWrapper } from "../sources/Lambda";
import { Agent } from "./Agent";
import { getInstance, setInstance } from "./AgentSingleton";
import { ReportingAPI } from "./api/ReportingAPI";
import { ReportingAPINodeHTTP } from "./api/ReportingAPINodeHTTP";
import { ReportingAPIRateLimitedClientSide } from "./api/ReportingAPIRateLimitedClientSide";
import { ReportingAPIRateLimitedServerSide } from "./api/ReportingAPIRateLimitedServerSide";
import { ReportingAPIThatValidatesToken } from "./api/ReportingAPIThatValidatesToken";
import { Token } from "./api/Token";
import { getAPIURL } from "./getAPIURL";
import { getWrappers } from "./getWrappers";
import { Logger } from "./logger/Logger";
import { LoggerConsole } from "./logger/LoggerConsole";
import { LoggerNoop } from "./logger/LoggerNoop";

function getLogger(): Logger {
  if (isDebugging()) {
    return new LoggerConsole();
  }

  return new LoggerNoop();
}

function validatesToken(api: ReportingAPI) {
  return new ReportingAPIThatValidatesToken(api);
}

function clientSideRateLimited(api: ReportingAPI) {
  return new ReportingAPIRateLimitedClientSide(api, {
    maxEventsPerInterval: 100,
    intervalInMs: 60 * 60 * 1000,
  });
}

function serverSideRateLimited(api: ReportingAPI) {
  return new ReportingAPIRateLimitedServerSide(api);
}

function getAPI(): ReportingAPI {
  return validatesToken(
    serverSideRateLimited(
      clientSideRateLimited(new ReportingAPINodeHTTP(getAPIURL()))
    )
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

// eslint-disable-next-line import/no-unused-modules
export function protect() {
  const agent = getAgent({
    serverless: undefined,
  });

  agent.start(getWrappers());
}

export function lambda(): (handler: Handler) => Handler {
  const agent = getAgent({
    serverless: "lambda",
  });

  agent.start(getWrappers());

  return createLambdaWrapper;
}

export function cloudFunction(): (handler: HttpFunction) => HttpFunction {
  const agent = getAgent({
    serverless: "gcp",
  });

  agent.start(getWrappers());

  return createCloudFunctionWrapper;
}
