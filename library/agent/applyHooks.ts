/* eslint-disable max-lines-per-function */
import { join, resolve } from "path";
import { cleanupStackTrace } from "../helpers/cleanupStackTrace";
import { wrap } from "../helpers/wrap";
import { getPackageVersion } from "../helpers/getPackageVersion";
import { satisfiesVersion } from "../helpers/satisfiesVersion";
import { escapeHTML } from "../helpers/escapeHTML";
import { Agent } from "./Agent";
import { attackKindHumanName } from "./Attack";
import { bindContext, getContext, updateContext } from "./Context";
import { BuiltinModule } from "./hooks/BuiltinModule";
import { ConstructorInterceptor } from "./hooks/ConstructorInterceptor";
import { Hooks } from "./hooks/Hooks";
import {
  InterceptorResult,
  MethodInterceptor,
} from "./hooks/MethodInterceptor";
import { ModifyingArgumentsMethodInterceptor } from "./hooks/ModifyingArgumentsInterceptor";
import { Package } from "./hooks/Package";
import { WrappableFile } from "./hooks/WrappableFile";
import { WrappableSubject } from "./hooks/WrappableSubject";
import { MethodResultInterceptor } from "./hooks/MethodResultInterceptor";
import { isPackageInstalled } from "../helpers/isPackageInstalled";

/**
 * Hooks allows you to register packages and then wrap specific methods on
 * the exports of the package. This doesn't do the actual wrapping yet.
 *
 * That's where applyHooks comes in, we take the registered packages and
 * its methods and do the actual wrapping so that we can intercept method calls.
 */
export function applyHooks(hooks: Hooks, agent: Agent) {
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
      wrapPackage(pkg, subjects, agent);
    }

    if (files.length > 0) {
      wrapFiles(pkg, files, agent);
    }
  });

  hooks.getBuiltInModules().forEach((module) => {
    const subjects = module.getSubjects();

    if (subjects.length > 0) {
      wrapBuiltInModule(module, subjects, agent);
    }
  });

  hooks.getGlobals().forEach((g) => {
    const name = g.getName();

    if (!(global as Record<string, unknown>)[name]) {
      return;
    }

    g.getMethodInterceptors()
      .reverse() // Reverse to make sure we wrap in the order they were added
      .forEach((interceptor) => {
        if (interceptor instanceof ModifyingArgumentsMethodInterceptor) {
          wrapWithArgumentModification(global, interceptor, name, agent);
        } else {
          wrapWithoutArgumentModification(global, interceptor, name, agent);
        }
      });
  });

  return wrapped;
}

function wrapFiles(pkg: Package, files: WrappableFile[], agent: Agent) {
  files.forEach((file) => {
    try {
      const exports = require(join(pkg.getName(), file.getRelativePath()));

      file
        .getSubjects()
        .forEach(
          (subject) => wrapSubject(exports, subject, pkg.getName(), agent),
          agent
        );
    } catch (error) {
      agent.onFailedToWrapFile(pkg.getName(), file.getRelativePath());
    }
  });
}

function wrapBuiltInModule(
  module: BuiltinModule,
  subjects: WrappableSubject[],
  agent: Agent
) {
  if (!isPackageInstalled(module.getName())) {
    return;
  }
  try {
    const exports = require(module.getName());

    subjects.forEach(
      (selector) => wrapSubject(exports, selector, module.getName(), agent),
      agent
    );
  } catch (error) {
    agent.onFailedToWrapPackage(module.getName());
  }
}

function wrapPackage(pkg: Package, subjects: WrappableSubject[], agent: Agent) {
  try {
    const exports = require(pkg.getName());

    subjects.forEach(
      (selector) => wrapSubject(exports, selector, pkg.getName(), agent),
      agent
    );
  } catch (error) {
    agent.onFailedToWrapPackage(pkg.getName());
  }
}

/**
 * Wraps a method call with an interceptor that doesn't modify the arguments of the method call.
 */
function wrapWithoutArgumentModification(
  subject: unknown,
  method: MethodInterceptor,
  module: string,
  agent: Agent
) {
  const libraryRoot = resolve(__dirname, "..");

  try {
    wrap(subject, method.getName(), function wrap(original: Function) {
      return function wrap() {
        // eslint-disable-next-line prefer-rest-params
        const args = Array.from(arguments);
        const context = getContext();

        for (let i = 0; i < args.length; i++) {
          if (typeof args[i] === "function") {
            args[i] = bindContext(args[i]);
          }
        }

        if (context) {
          const matches = agent.getConfig().getEndpoints(context);

          if (matches.find((match) => match.forceProtectionOff)) {
            return original.apply(
              // @ts-expect-error We don't now the type of this
              this,
              args
            );
          }
        }

        const start = performance.now();
        let result: InterceptorResult = undefined;

        try {
          // @ts-expect-error We don't now the type of this
          result = method.getInterceptor()(args, this, agent, context);
        } catch (error: any) {
          agent.getInspectionStatistics().interceptorThrewError(module);
          agent.onErrorThrownByInterceptor({
            error: error,
            method: method.getName(),
            module: module,
          });
        }

        const end = performance.now();
        agent.getInspectionStatistics().onInspectedCall({
          sink: module,
          attackDetected: !!result,
          blocked: agent.shouldBlock(),
          durationInMs: end - start,
          withoutContext: !context,
        });

        const isAllowedIP =
          context &&
          context.remoteAddress &&
          agent.getConfig().isAllowedIP(context.remoteAddress);

        if (result && context && !isAllowedIP) {
          // Flag request as having an attack detected
          updateContext(context, "attackDetected", true);

          agent.onDetectedAttack({
            module: module,
            operation: result.operation,
            kind: result.kind,
            source: result.source,
            blocked: agent.shouldBlock(),
            stack: cleanupStackTrace(new Error().stack!, libraryRoot),
            path: result.pathToPayload,
            metadata: result.metadata,
            request: context,
            payload: result.payload,
          });

          if (agent.shouldBlock()) {
            throw new Error(
              `Zen has blocked ${attackKindHumanName(result.kind)}: ${result.operation}(...) originating from ${result.source}${escapeHTML(result.pathToPayload)}`
            );
          }
        }

        return original.apply(
          // @ts-expect-error We don't now the type of this
          this,
          args
        );
      };
    });
  } catch (error) {
    agent.onFailedToWrapMethod(module, method.getName());
  }
}

/**
 * Wraps a method call with an interceptor that modifies the arguments of the method call.
 */
function wrapWithArgumentModification(
  subject: unknown,
  method: ModifyingArgumentsMethodInterceptor,
  module: string,
  agent: Agent
) {
  try {
    wrap(subject, method.getName(), function wrap(original: Function) {
      return function wrap() {
        // eslint-disable-next-line prefer-rest-params
        const args = Array.from(arguments);
        let updatedArgs = args;

        try {
          // @ts-expect-error We don't now the type of this
          updatedArgs = method.getInterceptor()(args, this, agent);
        } catch (error: any) {
          agent.onErrorThrownByInterceptor({
            error: error,
            method: method.getName(),
            module: module,
          });
        }

        return original.apply(
          // @ts-expect-error We don't now the type of this
          this,
          updatedArgs
        );
      };
    });
  } catch (error) {
    agent.onFailedToWrapMethod(module, method.getName());
  }
}

function wrapNewInstance(
  subject: unknown,
  constructor: ConstructorInterceptor,
  module: string,
  agent: Agent
) {
  const subjects = constructor.getSubjects();

  if (subjects.length === 0) {
    return;
  }

  try {
    wrap(subject, constructor.getName(), function wrap(original: Function) {
      return function wrap() {
        // eslint-disable-next-line prefer-rest-params
        const args = Array.from(arguments);

        // @ts-expect-error It's a constructor
        const newInstance = new original(...args);
        subjects.forEach((subject) => {
          wrapSubject(newInstance, subject, module, agent);
        });

        return newInstance;
      };
    });
  } catch (error) {
    agent.onFailedToWrapMethod(module, constructor.getName());
  }
}

/**
 * Wraps a method call with an interceptor that is called after the method call has returned.
 * Returns the arguments and the result of the method call.
 */
function wrapWithResult(
  subject: unknown,
  method: MethodResultInterceptor,
  module: string,
  agent: Agent
) {
  try {
    wrap(subject, method.getName(), function wrap(original: Function) {
      return function wrap() {
        // eslint-disable-next-line prefer-rest-params
        const args = Array.from(arguments);

        const result = original.apply(
          // @ts-expect-error We don't now the type of this
          this,
          args
        );

        try {
          // @ts-expect-error We don't now the type of this
          method.getInterceptor()(args, result, this, agent);
        } catch (error: any) {
          agent.onErrorThrownByInterceptor({
            error: error,
            method: method.getName(),
            module: module,
          });
        }

        return result;
      };
    });
  } catch (error) {
    agent.onFailedToWrapMethod(module, method.getName());
  }
}

function wrapSubject(
  exports: unknown,
  subject: WrappableSubject,
  module: string,
  agent: Agent
) {
  const theSubject = subject.getSelector()(exports);

  if (!theSubject) {
    return;
  }

  subject
    .getMethodInterceptors()
    .reverse() // Reverse to make sure we wrap in the order they were added
    .forEach((method) => {
      if (method instanceof ModifyingArgumentsMethodInterceptor) {
        wrapWithArgumentModification(theSubject, method, module, agent);
      } else if (method instanceof MethodInterceptor) {
        wrapWithoutArgumentModification(theSubject, method, module, agent);
      } else if (method instanceof MethodResultInterceptor) {
        wrapWithResult(theSubject, method, module, agent);
      } else {
        wrapNewInstance(theSubject, method, module, agent);
      }
    });
}
