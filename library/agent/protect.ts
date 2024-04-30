import type { HttpFunction } from "@google-cloud/functions-framework";
import type { Handler } from "aws-lambda";
import { ChildProcess } from "../sinks/ChildProcess";
import { Fetch } from "../sinks/Fetch";
import { HTTPRequest } from "../sinks/HTTPRequest";
import { MongoDB } from "../sinks/MongoDB";
import { MySQL } from "../sinks/MySQL";
import { MySQL2 } from "../sinks/MySQL2";
import { Path } from "../sinks/Path";
import { Postgres } from "../sinks/Postgres";
import { Undici } from "../sinks/Undici";
import {
  createCloudFunctionWrapper,
  FunctionsFramework,
} from "../sources/FunctionsFramework";
import { Express } from "../sources/Express";
import { createLambdaWrapper } from "../sources/Lambda";
import { PubSub } from "../sources/PubSub";
import { Agent } from "./Agent";
import { getInstance, setInstance } from "./AgentSingleton";
import { ReportingAPI } from "./api/ReportingAPI";
import { ReportingAPINodeHTTP } from "./api/ReportingAPINodeHTTP";
import { ReportingAPIRateLimitedServerSide } from "./api/ReportingAPIRateLimitedServerSide";
import { ReportingAPIRateLimitedClientSide } from "./api/ReportingAPIRateLimitedClientSide";
import { ReportingAPIThatValidatesToken } from "./api/ReportingAPIThatValidatesToken";
import { Token } from "./api/Token";
import { Logger } from "./logger/Logger";
import { LoggerConsole } from "./logger/LoggerConsole";
import { LoggerNoop } from "./logger/LoggerNoop";
import { FileSystem } from "../sinks/FileSystem";

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

function getPusherAuthURL() {
  if (process.env.AIKIDO_URL) {
    const url = new URL(process.env.AIKIDO_URL);
    url.pathname = url.pathname.replace("/events", "/authenticate");

    return url;
  }

  return new URL("https://guard.aikido.dev/api/runtime/authenticate");
}

function getAPI(): ReportingAPI {
  let url = new URL("https://guard.aikido.dev/api/runtime/events");
  if (process.env.AIKIDO_URL) {
    url = new URL(process.env.AIKIDO_URL);
  }

  return validatesToken(
    serverSideRateLimited(clientSideRateLimited(new ReportingAPINodeHTTP(url)))
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
    serverless,
    {
      key: "b5532a9279048135883a",
      authUrl: getPusherAuthURL(),
    }
  );

  setInstance(agent);

  return agent;
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
    new FileSystem(),
    new HTTPRequest(),
    new Fetch(),
    new Undici(),
    new Path(),
  ];
}

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
