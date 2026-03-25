import type { ExecutionArgs } from "graphql/execution/execute";
import { FieldNode } from "graphql";
import { Agent } from "../../agent/Agent";
import { Context } from "../../agent/Context";
import { isLocalhostIP } from "../../helpers/isLocalhostIP";
import { extractTopLevelFieldsFromDocument } from "./extractTopLevelFieldsFromDocument";
import type { Endpoint } from "../../agent/Config";

type Result =
  | {
      block: false;
    }
  | {
      block: true;
      field: FieldNode;
      source: "ip";
      remoteAddress: string;
      operationType: "query" | "mutation";
      endpoint: Endpoint;
    }
  | {
      block: true;
      field: FieldNode;
      source: "user";
      userId: string;
      operationType: "query" | "mutation";
      endpoint: Endpoint;
    }
  | {
      block: true;
      field: FieldNode;
      source: "group";
      groupId: string;
      operationType: "query" | "mutation";
      endpoint: Endpoint;
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
  const isBypassedIP = context.remoteAddress
    ? agent.getConfig().isBypassedIP(context.remoteAddress)
    : false;

  for (const field of topLevelFields.fields) {
    const result = shouldRateLimitField(
      agent,
      context,
      field,
      topLevelFields.type,
      isFromLocalhostInProduction,
      isBypassedIP
    );

    if (result.block) {
      return result;
    }
  }

  return { block: false };
}

function shouldRateLimitField(
  agent: Agent,
  context: Context,
  field: FieldNode,
  operationType: "query" | "mutation",
  isFromLocalhostInProduction: boolean,
  isBypassedIP: boolean
): Result {
  const match = agent
    .getConfig()
    .getGraphQLField(context, field.name.value, operationType);

  if (!match || !match.graphql) {
    return { block: false };
  }

  const rateLimitedField = match;

  if (
    !rateLimitedField ||
    !rateLimitedField.rateLimiting ||
    !rateLimitedField.rateLimiting.enabled
  ) {
    return { block: false };
  }

  if (context.remoteAddress && !isFromLocalhostInProduction && !isBypassedIP) {
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
        operationType: operationType,
        endpoint: match,
      };
    }
  }

  if (context.rateLimitGroup) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${context.method}:${context.route}:group:${context.rateLimitGroup}:${operationType}:${field.name.value}`,
        rateLimitedField.rateLimiting.windowSizeInMS,
        rateLimitedField.rateLimiting.maxRequests
      );

    if (!allowed) {
      return {
        block: true,
        field: field,
        source: "group",
        groupId: context.rateLimitGroup,
        operationType: operationType,
        endpoint: match,
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
        operationType: operationType,
        endpoint: match,
      };
    }
  }

  return { block: false };
}
