import { getInstance } from "../AgentSingleton";
import { wrapDefaultOrNamed } from "./wrapDefaultOrNamed";
import { WrapPackageInfo } from "./WrapPackageInfo";

/**
 * Intercepts the creation of a new instance of a class, to wrap it's methods and properties.
 */
export function wrapNewInstance(
  subject: unknown,
  className: string | undefined,
  pkgInfo: WrapPackageInfo,
  interceptor: (exports: any) => void
) {
  const agent = getInstance();
  if (!agent) {
    throw new Error("Can not wrap new instance if agent is not initialized");
  }

  try {
    return wrapDefaultOrNamed(
      subject,
      className,
      function wrap(original: Function) {
        return function wrap() {
          const args = Array.from(arguments);

          // @ts-expect-error It's a constructor
          const newInstance = new original(...args);

          interceptor(newInstance);

          return newInstance;
        };
      }
    );
  } catch {
    agent.onFailedToWrapMethod(pkgInfo.name, className || "default export");
  }
}
