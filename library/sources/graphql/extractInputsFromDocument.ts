import type {
  DocumentNode,
  ValueNode,
  SelectionSetNode,
  FieldNode,
  ArgumentNode,
  FragmentDefinitionNode,
} from "graphql";

/**
 * Extract user inputs from a value node
 * @param value A value node
 * @param inputs An array that will be filled with the user inputs
 */
function extractInputsFromValue(value: ValueNode, inputs: string[]) {
  switch (value.kind) {
    case "StringValue":
      inputs.push(value.value);
      break;
    case "ListValue":
      for (const item of value.values) {
        extractInputsFromValue(item, inputs);
      }
      break;
    case "ObjectValue":
      for (const field of value.fields) {
        extractInputsFromValue(field.value, inputs);
      }
      break;
    default:
      break;
  }
}

/**
 * Extract user inputs from a list of arguments
 * @param args A array of argument nodes
 * @param inputs An array that will be filled with the user inputs
 */
function extractInputsFromArguments(
  args: ReadonlyArray<ArgumentNode>,
  inputs: string[]
) {
  for (const argument of args) {
    extractInputsFromValue(argument.value, inputs);
  }
}

/**
 * A recursive function that traverses a selection set and extracts user inputs.
 * @param selectionSet A graphql selection set node
 * @param inputs An array that will be filled with the user inputs
 */
function traverseSelectionSet(
  selectionSet: SelectionSetNode,
  inputs: string[]
) {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case "Field":
        const field = selection as FieldNode;
        if (field.arguments) {
          extractInputsFromArguments(field.arguments, inputs);
        }
        if (field.selectionSet) {
          traverseSelectionSet(field.selectionSet, inputs);
        }
        break;
      case "InlineFragment":
        traverseSelectionSet(selection.selectionSet, inputs);
        break;
      default:
        break;
    }
  }
}

/**
 * This function extracts user inputs (that could be harmful) from a GraphQL document.
 * @returns An array of user inputs.
 */
export function extractInputsFromDocument(document: DocumentNode): string[] {
  const inputs: string[] = [];

  for (const definition of document.definitions) {
    switch (definition.kind) {
      case "OperationDefinition":
        traverseSelectionSet(definition.selectionSet, inputs);
        break;
      case "FragmentDefinition":
        const fragment = definition as FragmentDefinitionNode;
        traverseSelectionSet(fragment.selectionSet, inputs);
        break;
      default:
        break;
    }
  }
  return inputs;
}
