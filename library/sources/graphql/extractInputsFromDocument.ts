import type {
  DocumentNode,
  ValueNode,
  SelectionSetNode,
  FieldNode,
  ArgumentNode,
  FragmentDefinitionNode,
} from "graphql";

/**
 * This function extracts user inputs (that could be harmful) from a GraphQL document.
 * @returns An array of user inputs.
 */
export function extractInputsFromDocument(document: DocumentNode): string[] {
  const inputs: string[] = [];

  // Extract user inputs from a value node
  const extractInputsFromValue = (value: ValueNode) => {
    switch (value.kind) {
      case "StringValue":
        // case "EnumValue": // Todo Check
        inputs.push(value.value);
        break;
      case "ListValue":
        for (const item of value.values) {
          extractInputsFromValue(item);
        }
        break;
      case "ObjectValue":
        for (const field of value.fields) {
          extractInputsFromValue(field.value);
        }
        break;
      case "Variable":
        // Todo unecessary?
        inputs.push(value.name.value);
        break;
      default:
        // Todo Handle other types if needed?
        break;
    }
  };

  // Extract user inputs from arguments
  const extractInputsFromArguments = (args: ReadonlyArray<ArgumentNode>) => {
    for (const argument of args) {
      extractInputsFromValue(argument.value);
    }
  };

  // Traverse a selection set
  const traverseSelectionSet = (selectionSet: SelectionSetNode) => {
    for (const selection of selectionSet.selections) {
      switch (selection.kind) {
        case "Field":
          const field = selection as FieldNode;
          if (field.arguments) {
            extractInputsFromArguments(field.arguments);
          }
          if (field.selectionSet) {
            traverseSelectionSet(field.selectionSet);
          }
          break;
        case "FragmentSpread":
        case "InlineFragment":
          // Todo Handle
          break;
        default:
          break;
      }
    }
  };

  for (const definition of document.definitions) {
    switch (definition.kind) {
      case "OperationDefinition":
        traverseSelectionSet(definition.selectionSet);
        break;
      case "FragmentDefinition":
        const fragment = definition as FragmentDefinitionNode;
        traverseSelectionSet(fragment.selectionSet);
        break;
      default:
        // Todo Handle other types?
        break;
    }
  }
  return inputs;
}
