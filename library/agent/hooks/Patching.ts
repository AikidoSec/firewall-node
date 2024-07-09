import { wrap } from "../../helpers/wrap";
import { Agent } from "../Agent";

type OnConstruct = (instance: unknown) => unknown;
type OnResult = (args: unknown[], result: unknown) => unknown;
type Wrapper = (original: Function) => Function;

export class Patcher {
  constructor(
    private readonly agent: Agent,
    private readonly moduleName: string
  ) {
    if (!this.moduleName) {
      throw new Error("Module name is required");
    }
  }

  wrapConstructor(
    subject: unknown,
    constructorName: string,
    onConstruct: OnConstruct
  ) {
    try {
      wrap(
        subject,
        constructorName,
        function createWrapperConstructor(original: Function) {
          return function wrappedConstructor() {
            // @ts-expect-error It's a constructor
            const newInstance = new original(...arguments);
            onConstruct(newInstance);

            return newInstance;
          };
        }
      );
    } catch (error) {
      this.agent.onFailedToWrapMethod(this.moduleName, constructorName);
    }
  }

  wrapFunctionOnObject(obj: unknown, name: string, wrapper: Wrapper) {
    try {
      wrap(obj, name, wrapper);
    } catch (error) {
      this.agent.onFailedToWrapMethod(this.moduleName, name);
    }
  }

  inspectResult(subject: unknown, methodName: string, onResult: OnResult) {
    const agent = this.agent;
    const module = this.moduleName;

    this.wrapFunctionOnObject(
      subject,
      methodName,
      function createInspectResult(original: Function): Function {
        return function inspectResult() {
          // eslint-disable-next-line prefer-rest-params
          const args = Array.from(arguments);

          const result = original.apply(
            // @ts-expect-error We don't now the type of this
            this,
            args
          );

          try {
            onResult(args, result);
          } catch (error: any) {
            agent.onErrorThrownByInterceptor({
              error: error,
              method: methodName,
              module: module,
            });
          }

          return result;
        };
      }
    );
  }
}
