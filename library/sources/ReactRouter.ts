import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestBodyParsing } from "./react-router/wrapRequestBodyParsing";

export class ReactRouter implements Wrapper {
  wrap(hooks: Hooks) {
    hooks
      .addPackage("react-router")
      .withVersion("^7.0.0")
      .addFileInstrumentation({
        path: /^dist\/(production|development)\/chunk-[A-Z0-9]+\.mjs$/,
        functions: [
          {
            // We cannot patch the `Request` global (as Request is also used by fetch calls)
            // We're interested in the Request object that gets passed to the server actions
            // See https://github.com/remix-run/react-router/blob/main/packages/react-router/lib/server-runtime/data.ts#L26
            nodeType: "FunctionDeclaration",
            name: "stripRoutesParam",
            operationKind: undefined,
            modifyReturnValue: (_, returnValue) => {
              if (returnValue instanceof Request) {
                wrapRequestBodyParsing(returnValue);
              }

              return returnValue;
            },
          },
        ],
      });
  }
}
