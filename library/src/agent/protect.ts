// eslint-disable-next-line import/no-unresolved
import { APIGatewayProxyHandler } from "aws-lambda";
import { getPackageVersion } from "../helpers/getPackageVersion";
import { satisfiesVersion } from "../helpers/satisfiesVersion";
import { Agent } from "./Agent";
import { getInstance, setInstance } from "./AgentSingleton";
import { API, APIFetch, APIThrottled, Token } from "./API";
import { IDGeneratorULID } from "./IDGenerator";
import { Express } from "../sources/Express";
import { createLambdaWrapper } from "../sources/Lambda";
import { MongoDB } from "../sinks/MongoDB";
import * as shimmer from "shimmer";
import { Logger, LoggerConsole, LoggerNoop } from "./Logger";
import { Wrapper } from "./Wrapper";

function wrapInstalledPackages() {
  const packages: Record<string, { range: string; wrapper: Wrapper }> = {
    express: {
      range: "^4.0.0",
      wrapper: new Express(),
    },
    mongodb: {
      range: "^4.0.0 || ^5.0.0 || ^6.0.0",
      wrapper: new MongoDB(),
    },
  };

  const wrapped: Record<string, string> = {};
  for (const packageName in packages) {
    const { range, wrapper } = packages[packageName];
    const version = getPackageVersion(packageName);

    if (version && satisfiesVersion(range, version)) {
      wrapped[packageName] = version;
      wrapper.wrap();
    }
  }

  return wrapped;
}

type Options = {
  debug: boolean;
  block: boolean;
};

const defaultOptions: Options = {
  debug: false,
  block: true,
};

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

function dryModeEnabled(): boolean {
  return (
    process.env.AIKIDO_NO_BLOCKING === "true" ||
    process.env.AIKIDO_NO_BLOCKING === "1"
  );
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
  const logger = getLogger(options);
  const token = getTokenFromEnv();
  const api = getAPI();
  const agent = new Agent(
    options.block,
    logger,
    api,
    token,
    new IDGeneratorULID(),
    serverless,
    installed
  );

  setInstance(agent);

  return agent;
}

function getOptions(partialOptions?: Partial<Options>): Options {
  const options = { ...defaultOptions, ...partialOptions };

  if (dryModeEnabled()) {
    options.block = false;
  }

  return options;
}

export function protect(options?: Partial<Options>) {
  // Disable shimmer logging
  shimmer({ logger: () => {} });

  const agent = getAgent({
    options: getOptions(options),
    serverless: false,
  });

  agent.start();

  process.on("exit", () => {
    agent.stop();
  });
}

export function lambda(
  options?: Partial<Options>
): (handler: APIGatewayProxyHandler) => APIGatewayProxyHandler {
  return (handler) => {
    // Disable shimmer logging
    shimmer({ logger: () => {} });

    const agent = getAgent({
      options: getOptions(options),
      serverless: true,
    });
    agent.start();

    return createLambdaWrapper(handler);
  };
}
