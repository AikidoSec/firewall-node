type Interceptor = (args: unknown[], subject: unknown) => void;

export class MethodInterceptor {
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

type ModifyingArgumentsInterceptor = (
  args: unknown[],
  subject: unknown
) => unknown[];

export class ModifyingArgumentsMethodInterceptor {
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
  private methods: (MethodInterceptor | ModifyingArgumentsMethodInterceptor)[] =
    [];

  constructor(private readonly selector: (exports: unknown) => unknown) {}

  inspect(methodName: string, interceptor: Interceptor) {
    const method = new MethodInterceptor(methodName, interceptor);
    this.methods.push(method);

    return method;
  }

  modifyArguments(
    methodName: string,
    interceptor: ModifyingArgumentsInterceptor
  ) {
    const method = new ModifyingArgumentsMethodInterceptor(
      methodName,
      interceptor
    );
    this.methods.push(method);

    return method;
  }

  getSelector() {
    return this.selector;
  }

  getMethodInterceptors() {
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
