import { Package } from "../Package";
import { BuiltinModule } from "../BuiltinModule";
import {
  IntereptorFunctionsObj,
  PackageFileInstrumentationInstructionJSON,
} from "./types";
import { satisfiesVersion } from "../../../helpers/satisfiesVersion";
import { RequireInterceptor } from "../RequireInterceptor";

// Keys are package / builtin names
let packages = new Map<string, PackageFileInstrumentationInstructionJSON[]>();

// Stores the callbacks for the instrumented functions of builtin modules
// Identifier for builtin is: moduleName.functionName
let builtinRequireInterceptors = new Map<string, RequireInterceptor[]>();
// Stores the callbacks for the instrumented functions of package files
// Identifier for package file is: packageName.relativePath.functionName.matchingVersion
let packageFileCallbacks = new Map<string, IntereptorFunctionsObj>();

export function setPackagesToInstrument(_packages: Package[]) {
  // Clear the previous packages
  packages = new Map();
  packageFileCallbacks = new Map();

  for (const pkg of _packages) {
    const packageInstructions = pkg
      .getVersions()
      .map((versionedPackage) => {
        return versionedPackage
          .getFileInstrumentationInstructions()
          .map((file) => {
            return {
              path: file.path,
              versionRange: versionedPackage.getRange(),
              functions: file.functions.map((func) => {
                const identifier = `${pkg.getName()}.${file.path}.${func.name}.${versionedPackage.getRange()}`;

                packageFileCallbacks.set(identifier, {
                  inspectArgs: func.inspectArgs,
                  modifyArgs: func.modifyArgs,
                  modifyReturnValue: func.modifyReturnValue,
                });

                return {
                  nodeType: func.nodeType,
                  name: func.name,
                  identifier,
                  inspectArgs: !!func.inspectArgs,
                  modifyArgs: !!func.modifyArgs,
                  modifyReturnValue: !!func.modifyReturnValue,
                };
              }),
            };
          })
          .flat();
      })
      .flat();

    if (packageInstructions.length !== 0) {
      packages.set(pkg.getName(), packageInstructions);
    }
  }
}

export function setBuiltinsToInstrument(builtinModules: BuiltinModule[]) {
  // Clear the previous builtins
  builtinRequireInterceptors = new Map();

  for (const builtin of builtinModules) {
    const interceptors = builtin.getRequireInterceptors();

    if (interceptors.length > 0) {
      builtinRequireInterceptors.set(builtin.getName(), interceptors);
    }
  }
}

export function shouldPatchPackage(name: string): boolean {
  return packages.has(name);
}

export function getPackageFileInstrumentationInstructions(
  packageName: string,
  version: string
): PackageFileInstrumentationInstructionJSON | undefined {
  const instructions = packages.get(packageName);
  if (!instructions) {
    return;
  }

  return instructions.find((f) => satisfiesVersion(f.versionRange, version));
}

export function getPackageCallbacks(
  identifier: string
): IntereptorFunctionsObj {
  return packageFileCallbacks.get(identifier) || {};
}

export function getBuiltinInterceptors(name: string): RequireInterceptor[] {
  return builtinRequireInterceptors.get(name) || [];
}

export function shouldPatchBuiltin(name: string): boolean {
  return builtinRequireInterceptors.has(name);
}
