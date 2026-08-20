import { Context, getContext, updateContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { PartialWrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { Wrapper } from "../agent/Wrapper";

// Methods that produce a new builder
// We need to keep wrapping builder objects they return so that `.query()/.mutation()/.subscription()`
// stays intercepted on chain calls
const CHAIN_METHODS = ["input", "output", "meta", "use", "concat"] as const;

// Methods that turn a builder into a procedure. The function passed here
// is the resolver that receives the fully parsed input.
const RESOLVER_METHODS = ["query", "mutation", "subscription"] as const;

type ResolverOpts = { input?: unknown };
type ProcedureBuilder = Record<string, unknown>;

// No longer needed when https://github.com/AikidoSec/firewall-node/pull/970 is merged
function formDataToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};

  formData.forEach((value, key) => {
    if (typeof value === "string") {
      obj[key] = value;
    }
  });

  return obj;
}

function captureInput(context: Context, input: unknown) {
  let value = input;

  if (globalThis.FormData && input instanceof globalThis.FormData) {
    value = formDataToObject(input);
  }

  const current = Array.isArray(context.trpc) ? context.trpc : [];
  updateContext(context, "trpc", current.concat([value]));
}

export class Trpc implements Wrapper {
  private wrapResolver(resolver: unknown) {
    if (typeof resolver !== "function") {
      return resolver;
    }

    return function wrappedResolver(this: unknown, ...args: unknown[]) {
      const opts = args[0] as ResolverOpts;
      const context = getContext();

      if (context && opts && typeof opts === "object" && "input" in opts) {
        captureInput(context, opts.input);
      }

      return resolver.apply(this, args);
    };
  }

  private wrapProcedureBuilder(builder: unknown): unknown {
    if (!builder || typeof builder !== "object") {
      return builder;
    }

    const original = builder as ProcedureBuilder;
    const wrapped: ProcedureBuilder = Object.create(original);

    for (const method of RESOLVER_METHODS) {
      if (typeof original[method] === "function") {
        const origFunc = original[method];
        wrapped[method] = (resolver: unknown, ...rest: unknown[]) =>
          origFunc(this.wrapResolver(resolver), ...rest);
      }
    }

    for (const method of CHAIN_METHODS) {
      if (typeof original[method] === "function") {
        const origFunc = original[method];
        wrapped[method] = (...args: unknown[]) =>
          this.wrapProcedureBuilder(origFunc(...args));
      }
    }

    return wrapped;
  }

  private wrapCreate(initTRPC: unknown, pkgInfo: PartialWrapPackageInfo) {
    if (!initTRPC || typeof initTRPC !== "object") {
      return;
    }

    // `create` lives on the shared prototype, so we wrap it there to cover every instance
    const proto = Object.getPrototypeOf(initTRPC);

    if (!proto || typeof proto.create !== "function") {
      return;
    }

    wrapExport(proto, "create", pkgInfo, {
      kind: undefined,
      modifyReturnValue: (args, returnValue) => {
        if (
          !returnValue ||
          typeof returnValue !== "object" ||
          !("procedure" in returnValue)
        ) {
          return returnValue;
        }

        const t = returnValue as ProcedureBuilder;

        return {
          ...t,
          procedure: this.wrapProcedureBuilder(t.procedure),
        };
      },
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("@trpc/server")
      .withVersion("^11.0.0")
      .onRequire((exports, pkgInfo) => {
        this.wrapCreate(exports.initTRPC, pkgInfo);
      })
      .addFileInstrumentation({
        path: "dist/index.mjs",
        functions: [],
        accessLocalVariables: {
          names: ["initTRPC"],
          cb: (vars, pkgInfo) => this.wrapCreate(vars[0], pkgInfo),
        },
      })
      .addFileInstrumentation({
        path: "dist/index.cjs",
        functions: [],
        accessLocalVariables: {
          names: ["module.exports"],
          cb: (vars, pkgInfo) => this.wrapCreate(vars[0]?.initTRPC, pkgInfo),
        },
      });
  }
}
