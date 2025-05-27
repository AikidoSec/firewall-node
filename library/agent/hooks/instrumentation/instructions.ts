import { Package } from "../Package";
import { BuiltinModule } from "../BuiltinModule";
import type {
  IntereptorCallbackInfoObj,
  PackageFileInstrumentationInstructionJSON,
} from "./types";
import { satisfiesVersion } from "../../../helpers/satisfiesVersion";
import { RequireInterceptor } from "../RequireInterceptor";

// Keys are package / builtin names
let packages = new Map<string, PackageFileInstrumentationInstructionJSON[]>();

// Stores the callbacks for the instrumented functions of builtin modules
// Identifier for builtin is: moduleName.functionName
let builtinRequireInterceptors = new Map<string, RequireInterceptor[]>();
// Stores the callback functions and necessary information for the instrumented functions of instrumented function
// Identifier for the function is: packageName.relativePath.functionName.nodeType.matchingVersion
let packageCallbackInfo = new Map<string, IntereptorCallbackInfoObj>();

export function setPackagesToInstrument(_packages: Package[]) {
  // Clear the previous packages
  packages = new Map();
  packageCallbackInfo = new Map();

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
                const identifier = `${pkg.getName()}.${file.path}.${func.name}.${func.nodeType}.${versionedPackage.getRange()}`;

                packageCallbackInfo.set(identifier, {
                  pkgName: pkg.getName(),
                  methodName: func.name,
                  operationKind: func.operationKind,
                  funcs: {
                    inspectArgs: func.inspectArgs,
                    modifyArgs: func.modifyArgs,
                    modifyReturnValue: func.modifyReturnValue,
                  },
                });

                return {
                  nodeType: func.nodeType,
                  name: func.name,
                  identifier,
                  inspectArgs: !!func.inspectArgs,
                  modifyArgs: !!func.modifyArgs,
                  modifyReturnValue: !!func.modifyReturnValue,
                  modifyArgumentsObject: func.modifyArgumentsObject ?? false,
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
  version: string,
  filePath: string
): PackageFileInstrumentationInstructionJSON | undefined {
  const instructions = packages.get(packageName);
  if (!instructions) {
    return;
  }

  return instructions.find(
    (f) => f.path === filePath && satisfiesVersion(f.versionRange, version)
  );
}

export function shouldPatchFile(
  packageName: string,
  filePath: string
): boolean {
  const instructions = packages.get(packageName);
  if (!instructions) {
    return false;
  }

  return instructions.some((f) => f.path === filePath);
}

export function getPackageCallbackInfo(
  identifier: string
): IntereptorCallbackInfoObj | undefined {
  return packageCallbackInfo.get(identifier);
}

export function getBuiltinInterceptors(name: string): RequireInterceptor[] {
  return builtinRequireInterceptors.get(name) || [];
}

export function shouldPatchBuiltin(name: string): boolean {
  return builtinRequireInterceptors.has(name);
}
