import type { ExecutionArgs } from "graphql/execution/execute";
import { FieldNode } from "graphql";
import { Agent } from "../../agent/Agent";
import { Endpoint } from "../../agent/Config";
import { Context } from "../../agent/Context";
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
  const match = agent
    .getConfig()
    .getEndpoint(context, (endpoint) => !!endpoint.graphql);

  if (!match || !match.endpoint.graphql) {
    return { block: false };
  }

  const topLevelFields = extractTopLevelFieldsFromDocument(
    executeArgs.document,
    executeArgs.operationName ? executeArgs.operationName : undefined
  );

  if (!topLevelFields) {
    return { block: false };
  }

  for (const field of topLevelFields.fields) {
    const result = shouldRateLimitField(
      agent,
      context,
      field,
      topLevelFields.type,
      match.endpoint.graphql
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
  graphql: NonNullable<Endpoint["graphql"]>
): Result {
  const rateLimitedField = graphql.fields.find(
    (f) => f.name === field.name.value && f.type === operationType
  );

  if (
    !rateLimitedField ||
    !rateLimitedField.rateLimiting ||
    !rateLimitedField.rateLimiting.enabled
  ) {
    return { block: false };
  }

  if (context.remoteAddress) {
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
