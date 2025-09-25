import type { OperationKind } from "../../api/Event";
import type {
  InspectArgsInterceptor,
  ModifyArgsInterceptor,
  ModifyReturnValueInterceptor,
} from "../wrapExport";
import type { PartialWrapPackageInfo } from "../WrapPackageInfo";

type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

type LoadReturnValue = {
  format: string;
  shortCircuit: boolean | undefined;
  source: string | ArrayBuffer | TypedArray;
};

type ResolveReturnValue = {
  format: string | null | undefined;
  importAttributes: object | undefined;
  shortCircuit: boolean | undefined;
  url: string;
};

export type LoadFunction = (
  url: string,
  context: {
    conditions: Set<string> | string[];
    format: string | null | undefined;
    importAttributes: object;
  },
  nextLoad: (url: string, context: object) => LoadReturnValue
) => LoadReturnValue;

export type RegisterHookFunction = (options: {
  load?: LoadFunction;
  resolve?: (
    specifier: string,
    context: {
      conditions: string[];
      importAttributes: object;
      parentURL: string;
    },
    nextResolve: (specifier: string, context: object) => ResolveReturnValue
  ) => ResolveReturnValue;
}) => void;

export type IntereptorFunctionsObj = {
  inspectArgs?: InspectArgsInterceptor;
  modifyArgs?: ModifyArgsInterceptor;
  modifyReturnValue?: ModifyReturnValueInterceptor;
  bindContext: boolean;
};

export type IntereptorCallbackInfoObj = {
  pkgName: string;
  methodName: string;
  operationKind: OperationKind | undefined;
  funcs: IntereptorFunctionsObj;
};

export type LocalVariableAccessConfig = {
  /**
   * Names of local variables that should be accessed
   */
  names: string[];
  /**
   * Callback function to be called with the accessed variable values.
   */
  cb: (vars: any[], pkgInfo: PartialWrapPackageInfo) => void;
};

export type FileCallbackInfoObj = {
  pkgName: string;
  localVariableAccessCb: LocalVariableAccessConfig["cb"];
};

export type PackageFunctionInstrumentationInstruction = {
  nodeType:
    | "MethodDefinition"
    | "FunctionAssignment"
    | "FunctionDeclaration"
    | "FunctionExpression"
    | "FunctionVariableDeclaration";
  name: string;
  /**
   * Used for stats reporting to core, e.g. sql_op
   */
  operationKind: OperationKind | undefined;
  inspectArgs?: InspectArgsInterceptor;
  modifyArgs?: ModifyArgsInterceptor;
  modifyReturnValue?: ModifyReturnValueInterceptor;
  /**
   * If true, the arguments object will be modified by modifyArgs instead of modifying the named arguments.
   *
   * Why is this needed?
   * If the library object uses the arguments object instead of named function arguments and no named arguments are defined in the function / method definition
   * or not all arguments are defined, we need to modify the arguments object instead of the named arguments.
   *
   * Important to know:
   * In strict mode, the arguments object and the named arguments are not synced, so changing the arguments object will not change the named arguments and vice versa.
   */
  modifyArgumentsObject?: boolean;
  /**
   * Binds the given function to the current execution context to prevent that the Zen context using the async local storage is lost.
   * If enabled, the bindContext function will be called for all callbacks that are passed to the function.
   */
  bindContext?: boolean;
};

export type PackageFileInstrumentationInstruction = {
  path: string; // Relative path to required file inside the package folder
  functions: PackageFunctionInstrumentationInstruction[];
  /**
   * Access module local variables
   * Use cases:
   *  - Call functions without importing them
   *  - Monkey patch exports of native Node.js addons
   * Please prefer using the normal function instrumentation instead of this, if possible.
   */
  accessLocalVariables?: LocalVariableAccessConfig;
};

export type PackageFileInstrumentationInstructionJSON = {
  path: string; // Relative path to required file inside the package folder
  versionRange: string;
  identifier: string;
  accessLocalVariables: string[];
  functions: {
    nodeType: PackageFunctionInstrumentationInstruction["nodeType"];
    name: string;
    identifier: string;
    inspectArgs: boolean;
    modifyArgs: boolean;
    modifyReturnValue: boolean;
    modifyArgumentsObject: boolean;
  }[];
};
