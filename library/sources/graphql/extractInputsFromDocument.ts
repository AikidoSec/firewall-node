import type { DocumentNode, StringValueNode } from "graphql";

/**
 * This function extracts user inputs (that could be harmful) from a GraphQL document.
 * @returns An array of user inputs.
 */
export function extractInputsFromDocument(document: DocumentNode): string[] {
  let graphql;
  try {
    // Assuming graphql is installed when this function is called
    // Don't use normal import for graphql
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Fixed in open PR
    graphql = require("graphql");
  } catch {
    return [];
  }

  const inputs: string[] = [];
  graphql.visit(document, {
    StringValue(node: StringValueNode) {
      inputs.push(node.value);
    },
  });

  return inputs;
}
