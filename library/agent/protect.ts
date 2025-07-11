import type { HttpFunction } from "@google-cloud/functions-framework";
import type { Handler } from "aws-lambda";
import { ChildProcess } from "../sinks/ChildProcess";
import { Fetch } from "../sinks/Fetch";
import { FileSystem } from "../sinks/FileSystem";
import { HTTPRequest } from "../sinks/HTTPRequest";
import { MariaDB } from "../sinks/MariaDB";
import { MongoDB } from "../sinks/MongoDB";
import { MySQL } from "../sinks/MySQL";
import { MySQL2 } from "../sinks/MySQL2";
import { Path } from "../sinks/Path";
import { Postgres } from "../sinks/Postgres";
import { Undici } from "../sinks/Undici";
import { Express } from "../sources/Express";
import {
  createCloudFunctionWrapper,
  FunctionsFramework,
} from "../sources/FunctionsFramework";
import { Hono } from "../sources/Hono";
import { HTTPServer } from "../sources/HTTPServer";
import { createLambdaWrapper } from "../sources/Lambda";
import { PubSub } from "../sources/PubSub";
import { Agent } from "./Agent";
import { getInstance, setInstance } from "./AgentSingleton";
import { ReportingAPI } from "./api/ReportingAPI";
import { ReportingAPINodeHTTP } from "./api/ReportingAPINodeHTTP";
import { ReportingAPIRateLimitedClientSide } from "./api/ReportingAPIRateLimitedClientSide";
import { ReportingAPIRateLimitedServerSide } from "./api/ReportingAPIRateLimitedServerSide";
import { ReportingAPIThatValidatesToken } from "./api/ReportingAPIThatValidatesToken";
import { Token } from "./api/Token";
import { getAPIURL } from "./getAPIURL";
import { Logger } from "./logger/Logger";
import { LoggerConsole } from "./logger/LoggerConsole";
import { LoggerNoop } from "./logger/LoggerNoop";
import { GraphQL } from "../sources/GraphQL";
import { Xml2js } from "../sources/Xml2js";
import { FastXmlParser } from "../sources/FastXmlParser";
import { SQLite3 } from "../sinks/SQLite3";
import { XmlMinusJs } from "../sources/XmlMinusJs";
import { Hapi } from "../sources/Hapi";
import { Shelljs } from "../sinks/Shelljs";
import { NodeSQLite } from "../sinks/NodeSQLite";
import { BetterSQLite3 } from "../sinks/BetterSQLite3";
import { isDebugging } from "../helpers/isDebugging";
import { shouldBlock } from "../helpers/shouldBlock";
import { Postgresjs } from "../sinks/Postgresjs";
import { Fastify } from "../sources/Fastify";
import { Koa } from "../sources/Koa";
import { Restify } from "../sources/Restify";
import { ClickHouse } from "../sinks/ClickHouse";
import { Prisma } from "../sinks/Prisma";
import { AwsSDKVersion2 } from "../sinks/AwsSDKVersion2";
import { OpenAI } from "../sinks/OpenAI";
import { AwsSDKVersion3 } from "../sinks/AwsSDKVersion3";
import { AiSDK } from "../sinks/AiSDK";
import { Mistral } from "../sinks/Mistral";
import { Anthropic } from "../sinks/Anthropic";

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

function startAgent({ serverless }: { serverless: string | undefined }) {
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

  agent.start(getWrappers());

  return agent;
}

export function getWrappers() {
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
    new HTTPServer(),
    new Hono(),
    new GraphQL(),
    new OpenAI(),
    new Mistral(),
    new Anthropic(),
    new Xml2js(),
    new FastXmlParser(),
    new SQLite3(),
    new XmlMinusJs(),
    new Shelljs(),
    new Hapi(),
    new MariaDB(),
    new NodeSQLite(),
    new BetterSQLite3(),
    new Postgresjs(),
    new Fastify(),
    new Koa(),
    new Restify(),
    new ClickHouse(),
    new Prisma(),
    new AwsSDKVersion3(),
    // new Function(), Disabled because functionName.constructor === Function is false after patching global
    new AwsSDKVersion2(),
    new AiSDK(),
  ];
}

export function protect() {
  startAgent({
    serverless: undefined,
  });
}

export function lambda(): (handler: Handler) => Handler {
  startAgent({
    serverless: "lambda",
  });

  return createLambdaWrapper;
}

export function cloudFunction(): (handler: HttpFunction) => HttpFunction {
  startAgent({
    serverless: "gcp",
  });

  return createCloudFunctionWrapper;
}
