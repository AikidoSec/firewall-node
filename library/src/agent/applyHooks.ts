/* eslint-disable max-lines-per-function */
import { join } from "path";
import { wrap } from "shimmer";
import { getPackageVersion } from "../helpers/getPackageVersion";
import { satisfiesVersion } from "../helpers/satisfiesVersion";
import { Agent } from "./Agent";
import { attackKindHumanName } from "./Attack";
import { getContext } from "./Context";
import { BuiltinModule } from "./hooks/BuiltinModule";
import { Hooks } from "./hooks/Hooks";
import {
  InterceptorResult,
  MethodInterceptor,
} from "./hooks/MethodInterceptor";
import { ModifyingArgumentsMethodInterceptor } from "./hooks/ModifyingArgumentsInterceptor";
import { Package } from "./hooks/Package";
import { WrappableFile } from "./hooks/WrappableFile";
import { WrappableSubject } from "./hooks/WrappableSubject";
import { sourceHumanName } from "./Source";

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

  return wrapped;
}

function wrapFiles(pkg: Package, files: WrappableFile[], agent: Agent) {
  files.forEach((file) => {
    const exports = require(join(pkg.getName(), file.getRelativePath()));

    file
      .getSubjects()
      .forEach(
        (subject) => wrapSubject(exports, subject, pkg.getName(), agent),
        agent
      );
  });
}

function wrapBuiltInModule(
  module: BuiltinModule,
  subjects: WrappableSubject[],
  agent: Agent
) {
  const exports = require(module.getName());

  subjects.forEach(
    (selector) => wrapSubject(exports, selector, module.getName(), agent),
    agent
  );
}

function wrapPackage(pkg: Package, subjects: WrappableSubject[], agent: Agent) {
  const exports = require(pkg.getName());

  subjects.forEach(
    (selector) => wrapSubject(exports, selector, pkg.getName(), agent),
    agent
  );
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
  // @ts-expect-error We don't now the type of the subject
  wrap(subject, method.getName(), function wrap(original: Function) {
    return function wrap() {
      const context = getContext();

      if (!context) {
        agent.getInspectionStatistics().inspectedCallWithoutContext(module);

        return original.apply(
          // @ts-expect-error We don't now the type of this
          this,
          // eslint-disable-next-line prefer-rest-params
          arguments
        );
      }

      // eslint-disable-next-line prefer-rest-params
      const args = Array.from(arguments);
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
      });

      if (result) {
        // Flag request as having an attack detected
        context.attackDetected = true;

        agent.onDetectedAttack({
          module: module,
          operation: result.operation,
          kind: result.kind,
          source: result.source,
          blocked: agent.shouldBlock(),
          stack: new Error().stack!,
          path: result.pathToPayload,
          metadata: result.metadata,
          request: context,
          payload: result.payload,
        });

        if (agent.shouldBlock()) {
          throw new Error(
            `Aikido runtime has blocked a ${attackKindHumanName(result.kind)}: ${result.operation}(...) originating from ${sourceHumanName(result.source)}${result.pathToPayload}`
          );
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
  module: string,
  agent: Agent
) {
  // @ts-expect-error We don't now the type of the subject
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

  subject.getMethodInterceptors().forEach((method) => {
    if (method instanceof ModifyingArgumentsMethodInterceptor) {
      wrapWithArgumentModification(theSubject, method, module, agent);
    } else {
      wrapWithoutArgumentModification(theSubject, method, module, agent);
    }
  });
}
