import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { inspectArgs } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForJsInjection } from "../vulnerabilities/js-injection/checkContextForJsInjection";
import { getInstance } from "../agent/AgentSingleton";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";
import { decodeDataUrl, isJsDataUrl } from "../helpers/decodeDataUrl";

export class WorkerThreads implements Wrapper {
  #inspectCode(args: unknown[]) {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    if (args.length === 0 || typeof args[0] !== "string") {
      return undefined;
    }

    const code = args[0];

    return checkContextForJsInjection({
      js: code,
      operation: "new Worker(...)",
      context,
    });
  }

  #isEvalOp(args: unknown[]): boolean {
    if (args.length < 2 || typeof args[0] !== "string") {
      return false;
    }

    const options = args[1];
    if (typeof options !== "object" || options === null) {
      return false;
    }

    return "eval" in options && !!options.eval;
  }

  #isDataUrlOp(args: unknown[]): boolean {
    return args[0] instanceof URL && args[0].protocol === "data:";
  }

  #inspectDataUrlCode(args: unknown[]) {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    const url = args[0];
    if (!(url instanceof URL)) {
      return undefined;
    }

    if (!isJsDataUrl(url)) {
      return undefined;
    }

    const code = decodeDataUrl(url);
    if (code === undefined) {
      return undefined;
    }

    return checkContextForJsInjection({
      js: code,
      operation: "new Worker(...)",
      context,
    });
  }

  #inspectFilePath(args: unknown[]) {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    const path = args[0];

    if (typeof path === "string" || path instanceof URL) {
      const result = checkContextForPathTraversal({
        filename: path,
        operation: "new Worker(...)",
        context: context,
      });

      if (result) {
        return result;
      }
    }
  }

  private onConstruct(target: any, args: unknown[], newTarget: Function) {
    const agent = getInstance();
    const context = getContext();

    if (!agent || !context || args.length === 0) {
      return Reflect.construct(target, args, newTarget);
    }

    if (this.#isEvalOp(args)) {
      inspectArgs(
        args,
        () => this.#inspectCode(args),
        context,
        agent,
        {
          name: "worker_threads",
          type: "builtin",
        },
        "new Worker(...)",
        "eval_op"
      );
    } else if (this.#isDataUrlOp(args)) {
      inspectArgs(
        args,
        () => this.#inspectDataUrlCode(args),
        context,
        agent,
        {
          name: "worker_threads",
          type: "builtin",
        },
        "new Worker(...)",
        "eval_op"
      );
    } else {
      inspectArgs(
        args,
        () => this.#inspectFilePath(args),
        context,
        agent,
        {
          name: "worker_threads",
          type: "builtin",
        },
        "new Worker(...)",
        "exec_op"
      );
    }

    return Reflect.construct(target, args, newTarget);
  }

  wrap(hooks: Hooks): void {
    hooks.addBuiltinModule("worker_threads").onRequire((exports) => {
      // We can't use our helper wrapNewInstance because it can not inspect constructor args
      exports.Worker = new Proxy(exports.Worker, {
        construct: (target, args, newTarget) =>
          this.onConstruct(target, args, newTarget),
      });
    });
  }
}
