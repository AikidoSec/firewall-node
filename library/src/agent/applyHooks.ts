import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { getPackageVersion } from "../helpers/getPackageVersion";
import { satisfiesVersion } from "../helpers/satisfiesVersion";
import { DangerousMethod, Hooks, SafeMethod } from "./Wrapper";

/**
 * Hooks allows you to register packages and then wrap specific methods on
 * the exports of the package. This doesn't do the actual wrapping yet.
 *
 * That's where applyHooks comes in, we take the registered packages and
 * its methods and do the actual wrapping so that we can intercept method calls.
 */
export function applyHooks(hooks: Hooks) {
  const wrapped: Record<string, { version: string; supported: boolean }> = {};

  hooks.getPackages().forEach((pkg) => {
    const version = getPackageVersion(pkg.getName());

    if (!version) {
      return;
    }

    const selectors = pkg
      .getVersions()
      .map((versioned) => {
        if (!satisfiesVersion(versioned.getRange(), version)) {
          return [];
        }

        return versioned.getSelectors();
      })
      .flat();

    if (selectors.length === 0) {
      return;
    }

    wrapped[pkg.getName()] = {
      version,
      supported: true,
    };

    new Hook([pkg.getName()], (exports) => {
      selectors.forEach((selector) => {
        const subject = selector.getSelector()(exports);

        if (!subject) {
          return;
        }

        selector.getMethods().forEach((method) => {
          if (method instanceof SafeMethod) {
            safelyWrapMethodCalls(subject, method);
          } else {
            dangerouslyWrapMethodCalls(subject, method);
          }
        });
      });

      return exports;
    });
  });

  return wrapped;
}

/**
 * Wraps a method call with a safe interceptor, which doesn't modify the arguments of the method call.
 */
function safelyWrapMethodCalls(subject: unknown, method: SafeMethod) {
  // @ts-expect-error We don't now the type of the subject
  wrap(subject, method.getName(), function wrap(original: Function) {
    return function wrap() {
      // eslint-disable-next-line prefer-rest-params
      const args = Array.from(arguments);
      // @ts-expect-error We don't now the type of this
      method.getInterceptor()(args, this);

      return original.apply(
        // @ts-expect-error We don't now the type of this
        this,
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
    };
  });
}

/**
 * Wraps a method call with a dangerous interceptor, which modifies the arguments of the method call.
 */
function dangerouslyWrapMethodCalls(subject: unknown, method: DangerousMethod) {
  // @ts-expect-error We don't now the type of the subject
  wrap(subject, method.getName(), function wrap(original: Function) {
    return function wrap() {
      // eslint-disable-next-line prefer-rest-params
      const args = Array.from(arguments);
      // @ts-expect-error We don't now the type of this
      const updatedArgs = method.getInterceptor()(args, this);

      return original.apply(
        // @ts-expect-error We don't now the type of this
        this,
        // eslint-disable-next-line prefer-rest-params
        Array.isArray(updatedArgs) ? updatedArgs : arguments
      );
    };
  });
}
