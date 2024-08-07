import type { ExecutionArgs } from "graphql/execution/execute";
import { FieldNode } from "graphql";
import { Agent } from "../../agent/Agent";
import { Context } from "../../agent/Context";
import { isLocalhostIP } from "../../helpers/isLocalhostIP";
import { extractTopLevelFieldsFromDocument } from "./extractTopLevelFieldsFromDocument";

type Result =
  | {
      block: false;
    }
  | {
      block: true;
      field: FieldNode;
      source: "ip";
      remoteAddress: string;
    }
  | {
      block: true;
      field: FieldNode;
      source: "user";
      userId: string;
    };

export function shouldRateLimitOperation(
  agent: Agent,
  context: Context,
  executeArgs: Pick<ExecutionArgs, "document" | "operationName">
): Result {
  const topLevelFields = extractTopLevelFieldsFromDocument(
    executeArgs.document,
    executeArgs.operationName ? executeArgs.operationName : undefined
  );

  if (!topLevelFields) {
    return { block: false };
  }

  const isProduction = process.env.NODE_ENV === "production";

  // Allow requests from localhost in development to be rate limited
  // In production, we don't want to rate limit localhost
  const isFromLocalhostInProduction = context.remoteAddress
    ? isLocalhostIP(context.remoteAddress) && isProduction
    : false;

  // Allow requests from allowed IPs, e.g. never rate limit office IPs
  const isAllowedIP = context.remoteAddress
    ? agent.getConfig().isAllowedIP(context.remoteAddress)
    : false;

  for (const field of topLevelFields.fields) {
    const result = shouldRateLimitField(
      agent,
      context,
      field,
      topLevelFields.type,
      isFromLocalhostInProduction,
      isAllowedIP
    );

    if (result.block) {
      return result;
    }
  }

  return { block: false };
}

// eslint-disable-next-line max-lines-per-function
function shouldRateLimitField(
  agent: Agent,
  context: Context,
  field: FieldNode,
  operationType: "query" | "mutation",
  isFromLocalhostInProduction: boolean,
  isAllowedIP: boolean
): Result {
  const rateLimitedField = agent
    .getConfig()
    .getGraphQLField(context, field.name.value, operationType);

  if (!rateLimitedField || !rateLimitedField.graphql) {
    return { block: false };
  }

  if (
    !rateLimitedField ||
    !rateLimitedField.rateLimiting ||
    !rateLimitedField.rateLimiting.enabled
  ) {
    return { block: false };
  }

  if (context.remoteAddress && !isFromLocalhostInProduction && !isAllowedIP) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${context.method}:${context.route}:ip:${context.remoteAddress}:${operationType}:${field.name.value}`,
        rateLimitedField.rateLimiting.windowSizeInMS,
        rateLimitedField.rateLimiting.maxRequests
      );

    if (!allowed) {
      return {
        block: true,
        field: field,
        source: "ip",
        remoteAddress: context.remoteAddress,
      };
    }
  }

  if (context.user) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${context.method}:${context.route}:user:${context.user.id}:${operationType}:${field.name.value}`,
        rateLimitedField.rateLimiting.windowSizeInMS,
        rateLimitedField.rateLimiting.maxRequests
      );

    if (!allowed) {
      return {
        block: true,
        field: field,
        source: "user",
        userId: context.user.id,
      };
    }
  }

  return { block: false };
}
