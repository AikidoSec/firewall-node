import { RequestContext } from "./requestContext";

export class Aikido {
  report({
    source,
    message,
    context,
    stack,
    metadata,
  }: {
    source: "query" | "body" | "headers";
    message: string;
    context: RequestContext;
    stack: string;
    metadata?: Record<string, unknown>;
  }) {
    console.log(source, message, context, stack, metadata);
  }
}
