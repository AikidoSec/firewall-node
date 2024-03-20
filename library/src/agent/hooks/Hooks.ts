import { BuiltinModule } from "./BuiltinModule";
import { Package } from "./Package";

export class Hooks {
  private readonly packages: Package[] = [];
  private readonly builtinModules: BuiltinModule[] = [];

  addPackage(packageName: string): Package {
    if (!packageName) {
      throw new Error("Package name is required");
    }

    const pkg = new Package(packageName);
    this.packages.push(pkg);

    return pkg;
  }

  addBuiltinModule(name: string): BuiltinModule {
    if (!name) {
      throw new Error("Name is required");
    }

    const module = new BuiltinModule(name);
    this.builtinModules.push(module);

    return module;
  }

  getPackages() {
    return this.packages;
  }

  getBuiltInModules() {
    return this.builtinModules;
  }
}
