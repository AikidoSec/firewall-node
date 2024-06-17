import type { DocumentNode, StringValueNode } from "graphql";

/**
 * This function extracts user inputs (that could be harmful) from a GraphQL document.
 * @returns An array of user inputs.
 */
export function extractInputsFromDocument(document: DocumentNode): string[] {
  // Assuming graphql is installed when this function is called
  // Don't use normal import for graphql
  const { visit } = require("graphql");

  const inputs: string[] = [];
  visit(document, {
    StringValue(node: StringValueNode) {
      inputs.push(node.value);
    },
  });

  return inputs;
}
