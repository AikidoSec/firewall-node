import type { OperationKind } from "../../api/Event";
import type {
  InspectArgsInterceptor,
  ModifyArgsInterceptor,
  ModifyReturnValueInterceptor,
} from "../wrapExport";

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
};

export type IntereptorCallbackInfoObj = {
  pkgName: string;
  methodName: string;
  operationKind: OperationKind | undefined;
  funcs: IntereptorFunctionsObj;
};

export type PackageFunctionInstrumentationInstruction = {
  nodeType: "MethodDefinition" | "FunctionAssignment" | "FunctionDeclaration";
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
};

export type PackageFileInstrumentationInstruction = {
  path: string; // Relative path to required file inside the package folder
  functions: PackageFunctionInstrumentationInstruction[];
};

export type PackageFileInstrumentationInstructionJSON = {
  path: string; // Relative path to required file inside the package folder
  versionRange: string;
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
