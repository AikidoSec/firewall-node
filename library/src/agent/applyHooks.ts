import { join } from "node:path";
import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { getPackageVersion } from "../helpers/getPackageVersion";
import { satisfiesVersion } from "../helpers/satisfiesVersion";
import { getInstance } from "./AgentSingleton";
import { Hooks } from "./hooks/Hooks";
import { MethodInterceptor } from "./hooks/MethodInterceptor";
import { ModifyingArgumentsMethodInterceptor } from "./hooks/ModifyingArgumentsInterceptor";
import { Package } from "./hooks/Package";
import { WrappableFile } from "./hooks/WrappableFile";
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

    wrapped[pkg.getName()] = {
      version,
      supported: false,
    };

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
      wrapWhenModuleIsRequired(pkg, subjects);
    }

    if (files.length > 0) {
      wrapFilesImmediately(pkg, files);
    }
  });

  return wrapped;
}

function wrapFilesImmediately(pkg: Package, files: WrappableFile[]) {
  files.forEach((file) => {
    const exports = require(join(pkg.getName(), file.getRelativePath()));

    file
      .getSubjects()
      .forEach((subject) => wrapSubject(exports, subject, pkg.getName()));
  });
}

function wrapWhenModuleIsRequired(pkg: Package, subjects: WrappableSubject[]) {
  new Hook([pkg.getName()], (exports) => {
    subjects.forEach((selector) =>
      wrapSubject(exports, selector, pkg.getName())
    );

    return exports;
  });
}

function isAikidoGuardBlockError(error: Error) {
  return error.message.startsWith("Aikido guard");
}

/**
 * Wraps a method call with an interceptor that doesn't modify the arguments of the method call.
 */
function wrapWithoutArgumentModification(
  subject: unknown,
  method: MethodInterceptor,
  module: string
) {
  // @ts-expect-error We don't now the type of the subject
  wrap(subject, method.getName(), function wrap(original: Function) {
    return function wrap() {
      // eslint-disable-next-line prefer-rest-params
      const args = Array.from(arguments);

      try {
        // @ts-expect-error We don't now the type of this
        method.getInterceptor()(args, this);
      } catch (error: any) {
        // Rethrow our own errors
        // Otherwise we cannot block injections
        if (isAikidoGuardBlockError(error)) {
          throw error;
        }

        const agent = getInstance();

        if (agent) {
          agent.onErrorThrownByInterceptor({
            error: error,
            method: method.getName(),
            module: module,
          });
        }
      }

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
  method: ModifyingArgumentsMethodInterceptor,
  module: string
) {
  // @ts-expect-error We don't now the type of the subject
  wrap(subject, method.getName(), function wrap(original: Function) {
    return function wrap() {
      // eslint-disable-next-line prefer-rest-params
      const args = Array.from(arguments);
      let updatedArgs = args;

      try {
        // @ts-expect-error We don't now the type of this
        updatedArgs = method.getInterceptor()(args, this);
      } catch (error: any) {
        // Rethrow our own errors
        // Otherwise we cannot block injections
        if (isAikidoGuardBlockError(error)) {
          throw error;
        }

        const agent = getInstance();

        if (agent) {
          agent.onErrorThrownByInterceptor({
            error: error,
            method: method.getName(),
            module: module,
          });
        }
      }

      return original.apply(
        // @ts-expect-error We don't now the type of this
        this,
        updatedArgs
      );
    };
  });
}

function wrapSubject(
  exports: unknown,
  subject: WrappableSubject,
  module: string
) {
  const theSubject = subject.getSelector()(exports);

  if (!theSubject) {
    return;
  }

  subject.getMethodInterceptors().forEach((method) => {
    if (method instanceof ModifyingArgumentsMethodInterceptor) {
      wrapWithArgumentModification(theSubject, method, module);
    } else {
      wrapWithoutArgumentModification(theSubject, method, module);
    }
  });
}
