import {
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
    conditions: string[];
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

export type BuiltinInstrumentationInstruction = {
  functions: {
    name: string;
    inspectArgs: boolean;
  }[];
};

export type PackageFileInstrumentationInstruction = {
  path: string; // Relative path to required file inside the package folder
  functions: {
    nodeType: "MethodDefinition";
    name: string;
    inspectArgs?: InspectArgsInterceptor;
    modifyArgs?: ModifyArgsInterceptor;
    modifyReturnValue?: ModifyReturnValueInterceptor;
  }[];
};
