import { OperationKind } from "../api/Event";
import { BuiltinModule } from "./BuiltinModule";
import { Global } from "./Global";
import { Package } from "./Package";
import { InterceptorObject } from "./wrapExport";

export class Hooks {
  private readonly packages: Package[] = [];
  private readonly builtinModules: BuiltinModule[] = [];
  private readonly globals: Global[] = [];

  addPackage(packageName: string): Package {
    const pkg = new Package(packageName);
    this.packages.push(pkg);

    return pkg;
  }

  addGlobal(
    name: string,
    interceptors: InterceptorObject,
    kind: OperationKind
  ) {
    const global = new Global(name, interceptors, kind);
    this.globals.push(global);
  }

  addBuiltinModule(name: string): BuiltinModule {
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

  getGlobals() {
    return this.globals;
  }
}
