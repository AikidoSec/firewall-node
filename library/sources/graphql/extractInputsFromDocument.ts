import type { DocumentNode, StringValueNode } from "graphql";

/**
 * This function extracts user inputs (that could be harmful) from a GraphQL document.
 * @returns An array of user inputs.
 */
export function extractInputsFromDocument(
  document: DocumentNode,
  visitFn: typeof import("graphql").visit
): string[] {
  const inputs: string[] = [];
  visitFn(document, {
    StringValue(node: StringValueNode) {
      inputs.push(node.value);
    },
  });

  return inputs;
}
