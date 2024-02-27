import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { getPackageVersion } from "../helpers/getPackageVersion";
import { satisfiesVersion } from "../helpers/satisfiesVersion";
import { Hooks, Method } from "./Wrapper";

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

        selector
          .getMethods()
          .forEach((method) => interceptMethodCalls(subject, method));
      });

      return exports;
    });
  });

  return wrapped;
}

function interceptMethodCalls(subject: unknown, method: Method) {
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
