import type { APIGatewayProxyHandler } from "aws-lambda";
import { getPackageVersion } from "../helpers/getPackageVersion";
import { satisfiesVersion } from "../helpers/satisfiesVersion";
import { Agent } from "./Agent";
import { getInstance, setInstance } from "./AgentSingleton";
import { API, APIFetch, APIThrottled, Token } from "./API";
import { Express } from "../sources/Express";
import { createLambdaWrapper } from "../sources/Lambda";
import { MongoDB } from "../sinks/MongoDB";
import { Postgres } from "../sinks/Postgres";
import * as shimmer from "shimmer";
import { Logger, LoggerConsole, LoggerNoop } from "./Logger";
import { Wrapper } from "./Wrapper";
import { Options, getOptions } from "../helpers/getOptions";

function wrapInstalledPackages() {
  const packages = [new Postgres()];

  /*
    express: {
      range: "^4.0.0",
      wrapper: new Express(),
    },
    mongodb: {
      range: "^4.0.0 || ^5.0.0 || ^6.0.0",
      wrapper: new MongoDB(),
    }
  };*/

  const wrapped: Record<string, { version: string; supported: boolean }> = {};
  for (const wrapper of packages) {
    const version = getPackageVersion(wrapper.packageName);
    wrapped[wrapper.packageName] = {
      version,
      supported: version
        ? satisfiesVersion(wrapper.versionRange, version)
        : false,
    };

    if (wrapped[wrapper.packageName].supported) {
      wrapper.wrap();
    }
  }

  return wrapped;
}

function getLogger(options: Options): Logger {
  if (options.debug) {
    return new LoggerConsole();
  }

  return new LoggerNoop();
}

function throttle(api: API) {
  return new APIThrottled(api, {
    maxEventsPerInterval: 200,
    intervalInMs: 60 * 60 * 1000,
  });
}

function getAPI(): API {
  if (process.env.AIKIDO_URL) {
    return throttle(new APIFetch(new URL(process.env.AIKIDO_URL)));
  }

  return throttle(
    new APIFetch(new URL("https://guard.aikido.dev/api/runtime/events"))
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

  const installed = wrapInstalledPackages();
  const agent = new Agent(
    options.block,
    getLogger(options),
    getAPI(),
    getTokenFromEnv(),
    serverless,
    installed
  );

  setInstance(agent);

  return agent;
}

function disableShimmerLogging() {
  shimmer({ logger: () => {} });
}

export function protect(options?: Partial<Options>) {
  disableShimmerLogging();

  const agent = getAgent({
    options: getOptions(options),
    serverless: false,
  });

  agent.start();
}

export function lambda(
  options?: Partial<Options>
): (handler: APIGatewayProxyHandler) => APIGatewayProxyHandler {
  disableShimmerLogging();

  const agent = getAgent({
    options: getOptions(options),
    serverless: true,
  });

  agent.start();

  return createLambdaWrapper;
}
