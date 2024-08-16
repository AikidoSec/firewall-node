import { wrap } from "../../helpers/wrap";
import { getInstance } from "../AgentSingleton";
import { WrapPackageInfo } from "./WrapPackageInfo";

/**
 * Intercepts the creation of a new instance of a class, to wrap it's methods and properties.
 */
export function wrapNewInstance(
  subject: unknown,
  className: string,
  pkgInfo: WrapPackageInfo,
  interceptor: (exports: any) => void
) {
  const agent = getInstance();
  if (!agent) {
    throw new Error("Can not wrap new instance if agent is not initialized");
  }
  try {
    wrap(subject, className, function wrap(original: Function) {
      return function wrap() {
        // eslint-disable-next-line prefer-rest-params
        const args = Array.from(arguments);

        // @ts-expect-error It's a constructor
        const newInstance = new original(...args);

        interceptor(newInstance);

        return newInstance;
      };
    });
  } catch (error) {
    agent.onFailedToWrapMethod(pkgInfo.name, className);
  }
}
