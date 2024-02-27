import { Hook } from "require-in-the-middle";
import { wrap } from "shimmer";
import { getPackageVersion } from "../helpers/getPackageVersion";
import { satisfiesVersion } from "../helpers/satisfiesVersion";

type Interceptor = (args: unknown[], subject: unknown) => void | unknown[];

class Method {
  constructor(
    private readonly name: string,
    private readonly interceptor: Interceptor
  ) {
    if (!this.name) {
      throw new Error("Method name is required");
    }
  }

  getName() {
    return this.name;
  }

  getInterceptor() {
    return this.interceptor;
  }
}

class Selector {
  private methods: Method[] = [];

  constructor(private readonly selector: (exports: unknown) => unknown) {}

  method(name: string, interceptor: Interceptor) {
    const method = new Method(name, interceptor);
    this.methods.push(method);

    return method;
  }

  getSelector() {
    return this.selector;
  }

  getMethods() {
    return this.methods;
  }
}

class VersionedPackage {
  private selectors: Selector[] = [];

  constructor(private readonly range: string) {
    if (!this.range) {
      throw new Error("Version range is required");
    }
  }

  getRange() {
    return this.range;
  }

  subject(selector: (exports: any) => unknown): Selector {
    const fn = new Selector(selector);
    this.selectors.push(fn);

    return fn;
  }

  getSelectors() {
    return this.selectors;
  }
}

class Package {
  private versions: VersionedPackage[] = [];

  constructor(private readonly packageName: string) {}

  getName() {
    return this.packageName;
  }

  withVersion(range: string): VersionedPackage {
    const pkg = new VersionedPackage(range);
    this.versions.push(pkg);

    return pkg;
  }

  getVersions() {
    return this.versions;
  }
}

export class Hooks {
  private readonly packages: Package[] = [];

  package(packageName: string): Package {
    if (!packageName) {
      throw new Error("Package name is required");
    }

    const pkg = new Package(packageName);
    this.packages.push(pkg);

    return pkg;
  }

  getPackages() {
    return this.packages;
  }
}

function wrapMethod(subject: unknown, method: Method) {
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

export function wrapPackages(hooks: Hooks) {
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

        selector.getMethods().forEach((method) => wrapMethod(subject, method));
      });

      return exports;
    });
  });

  return wrapped;
}

export interface Wrapper {
  wrap(hooks: Hooks): void;
}
