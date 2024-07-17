import type {
  DocumentNode,
  ASTNode,
  FieldNode,
  OperationDefinitionNode,
} from "graphql";

export type Result =
  | undefined
  | { type: "query"; fields: FieldNode[] }
  | { type: "mutation"; fields: FieldNode[] };

export function extractTopLevelFieldsFromDocument(
  document: DocumentNode,
  operationName: string | undefined
): Result {
  const operations = document.definitions.filter(isOperationDefinition);

  if (operations.length === 0) {
    return undefined;
  }

  if (!operationName && operations.length === 1) {
    return extractFields(operations[0]);
  }

  if (operationName) {
    const operation = operations.find(
      (operation) => operation.name?.value === operationName
    );

    if (operation) {
      return extractFields(operation);
    }
  }

  return undefined;
}

function extractFields(node: OperationDefinitionNode): Result {
  const fields = node.selectionSet.selections.filter(isField);

  if (node.operation === "query") {
    return {
      type: "query",
      fields: fields,
    };
  }

  if (node.operation === "mutation") {
    return {
      type: "mutation",
      fields: fields,
    };
  }

  return undefined;
}

function isField(node: ASTNode): node is FieldNode {
  return node.kind === "Field";
}

function isOperationDefinition(node: ASTNode): node is OperationDefinitionNode {
  return node.kind === "OperationDefinition";
}
