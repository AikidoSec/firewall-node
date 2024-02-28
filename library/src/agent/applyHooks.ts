import { join } from "node:path";
import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { getPackageVersion } from "../helpers/getPackageVersion";
import { satisfiesVersion } from "../helpers/satisfiesVersion";
import { Hooks } from "./hooks/Hooks";
import { MethodInterceptor } from "./hooks/MethodInterceptor";
import { ModifyingArgumentsMethodInterceptor } from "./hooks/ModifyingArgumentsInterceptor";
import { WrappableSubject } from "./hooks/WrappableSubject";

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

    const versions = pkg
      .getVersions()
      .map((versioned) => {
        if (!satisfiesVersion(versioned.getRange(), version)) {
          return [];
        }

        return {
          subjects: versioned.getSubjects(),
          files: versioned.getFiles(),
        };
      })
      .flat();

    const files = versions.map((hook) => hook.files).flat();
    const subjects = versions.map((hook) => hook.subjects).flat();

    if (subjects.length === 0 && files.length === 0) {
      return;
    }

    wrapped[pkg.getName()] = {
      version,
      supported: true,
    };

    if (subjects.length > 0) {
      new Hook([pkg.getName()], (exports) => {
        subjects.forEach((selector) => wrapSubject(exports, selector));

        return exports;
      });
    }

    if (files.length > 0) {
      files.forEach((file) => {
        const exports = require(join(pkg.getName(), file.getRelativePath()));

        file.getSubjects().forEach((subject) => wrapSubject(exports, subject));
      });
    }
  });

  return wrapped;
}

/**
 * Wraps a method call with an interceptor that doesn't modify the arguments of the method call.
 */
function wrapWithoutArgumentModification(
  subject: unknown,
  method: MethodInterceptor
) {
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
 * Wraps a method call with an interceptor that modifies the arguments of the method call.
 */
function wrapWithArgumentModification(
  subject: unknown,
  method: ModifyingArgumentsMethodInterceptor
) {
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

function wrapSubject(exports: unknown, subject: WrappableSubject) {
  const theSubject = subject.getSelector()(exports);

  if (!theSubject) {
    return;
  }

  subject.getMethodInterceptors().forEach((method) => {
    if (method instanceof ModifyingArgumentsMethodInterceptor) {
      wrapWithArgumentModification(theSubject, method);
    } else {
      wrapWithoutArgumentModification(theSubject, method);
    }
  });
}
