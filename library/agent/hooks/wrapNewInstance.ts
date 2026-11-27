import { getInstance } from "../AgentSingleton";
import { wrapDefaultOrNamed } from "./wrapDefaultOrNamed";
import { PartialWrapPackageInfo } from "./WrapPackageInfo";

/**
 * Intercepts the creation of a new instance of a class, to wrap it's methods and properties.
 */
export function wrapNewInstance(
  subject: unknown,
  className: string | undefined,
  pkgInfo: PartialWrapPackageInfo,
  interceptor: (instance: any, constructorArgs: unknown[]) => unknown
) {
  try {
    return wrapDefaultOrNamed(
      subject,
      className,
      function wrap(original: Function) {
        return function wrap() {
          const args = Array.from(arguments);

          // @ts-expect-error It's a constructor
          const newInstance = new original(...args);

          try {
            const returnVal = interceptor(newInstance, args);
            if (returnVal) {
              return returnVal;
            }
          } catch (error) {
            if (error instanceof Error) {
              getInstance()?.onFailedToWrapMethod(
                pkgInfo.name,
                className || "default export",
                error
              );
            }
          }

          return newInstance;
        };
      }
    );
  } catch (error) {
    if (error instanceof Error) {
      getInstance()?.onFailedToWrapMethod(
        pkgInfo.name,
        className || "default export",
        error
      );
    }
  }
}
