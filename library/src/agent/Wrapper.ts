type SafeInterceptor = (args: unknown[], subject: unknown) => void;

type ModifyingArgumentsInterceptor = (
  args: unknown[],
  subject: unknown
) => unknown[];

export class SafeMethod {
  constructor(
    private readonly name: string,
    private readonly interceptor: SafeInterceptor
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

export class DangerousMethod {
  constructor(
    private readonly name: string,
    private readonly interceptor: ModifyingArgumentsInterceptor
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
  private methods: (SafeMethod | DangerousMethod)[] = [];

  constructor(private readonly selector: (exports: unknown) => unknown) {}

  inspect(name: string, interceptor: SafeInterceptor) {
    const method = new SafeMethod(name, interceptor);
    this.methods.push(method);

    return method;
  }

  dangerouslyModifyArguments(
    name: string,
    interceptor: ModifyingArgumentsInterceptor
  ) {
    const method = new DangerousMethod(name, interceptor);
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

export interface Wrapper {
  wrap(hooks: Hooks): void;
}
