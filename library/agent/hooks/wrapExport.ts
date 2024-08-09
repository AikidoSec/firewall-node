import { wrap } from "../../helpers/wrap";
import { Agent } from "../Agent";
import { getInstance } from "../AgentSingleton";
import { getContext } from "../Context";
import { InterceptorResult } from "./MethodInterceptor";
import { WrapPackageInfo } from "./WrapPackageInfo";

export function wrapExport(
  subject: unknown,
  propertyName: string,
  pkgInfo: WrapPackageInfo,
  interceptors: {
    inspectArgs?: (args: unknown[], agent: Agent) => InterceptorResult | void;
    modifyArgs?: (args: unknown[], agent: Agent) => unknown[];
    modifyReturnValue?: (
      args: unknown[],
      returnValue: unknown,
      agent: Agent
    ) => unknown;
  }
) {
  const agent = getInstance();
  if (!agent) {
    throw new Error("Can not wrap exports if agent is not initialized");
  }

  try {
    wrap(subject, propertyName, function wrap(original: Function) {
      return function wrap() {
        // eslint-disable-next-line prefer-rest-params
        const args = Array.from(arguments);
        const context = getContext();

        // Todo continue here

        return original.apply(
          // @ts-expect-error We don't now the type of this
          this,
          args
        );
      };
    });
  } catch (error) {
    agent.onFailedToWrapMethod(pkgInfo.name, propertyName);
  }
}
