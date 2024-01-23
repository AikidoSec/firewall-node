import { RequestContext } from "./requestContext";

export class Aikido {
  report({
    message,
    context,
    stack,
    metadata,
  }: {
    message: string;
    context: RequestContext;
    stack: string;
    metadata?: Record<string, unknown>;
  }) {
    console.log(message, context, stack, metadata);
  }
}
