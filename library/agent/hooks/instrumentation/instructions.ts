import { Package } from "../Package";
import { BuiltinModule } from "../BuiltinModule";
import {
  BuiltinInstrumentationInstructionJSON,
  IntereptorFunctionsObj,
  PackageFileInstrumentationInstructionJSON,
} from "./types";
import { satisfiesVersion } from "../../../helpers/satisfiesVersion";

// Keys are package / builtin names
let packages = new Map<string, PackageFileInstrumentationInstructionJSON[]>();
let builtins = new Map<string, BuiltinInstrumentationInstructionJSON>();

// Stores the callbacks for the instrumented functions of builtin modules
// Identifier for builtin is: moduleName.functionName
let builtinCallbacks = new Map<string, IntereptorFunctionsObj>();
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
  builtins = new Map();
  builtinCallbacks = new Map();

  for (const builtin of builtinModules) {
    const instructions = builtin.getInstrumentationInstruction();

    if (
      !instructions ||
      !instructions.functions ||
      instructions.functions.length === 0
    ) {
      continue;
    }

    // Check if function is included twice
    const functionNames = new Set<string>();
    for (const f of instructions.functions) {
      if (functionNames.has(f.name)) {
        throw new Error(
          `Function ${f.name} is included twice in the instrumentation instructions for ${builtin.getName()}`
        );
      }
      functionNames.add(f.name);
    }

    const functions = instructions.functions.map((f) => {
      builtinCallbacks.set(`${builtin.getName()}.${f.name}`, {
        inspectArgs: f.inspectArgs,
        modifyArgs: f.modifyArgs,
        modifyReturnValue: f.modifyReturnValue,
      });

      return {
        name: f.name,
        inspectArgs: !!f.inspectArgs,
        modifyArgs: !!f.modifyArgs,
        modifyReturnValue: !!f.modifyReturnValue,
      };
    });

    builtins.set(builtin.getName(), {
      functions,
    });
  }
}

export function getBuiltinInstrumentationInstructions(
  name: string
): BuiltinInstrumentationInstructionJSON | undefined {
  return builtins.get(name);
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
