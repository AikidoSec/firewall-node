import * as t from "tap";
import { getCallbackFunctionFromArgs } from "./getCallbackFunctionFromArgs";

t.test(
  "getCallbackFunctionFromArgs should return the last argument if it is a function",
  (t) => {
    const callback = () => {};
    const args = [1, "string", callback];
    const result = getCallbackFunctionFromArgs(args);
    t.equal(result, callback);
    t.end();
  }
);

t.test(
  "getCallbackFunctionFromArgs should return undefined if no function argument is found",
  (t) => {
    const args = [1, "string", true, null];
    const result = getCallbackFunctionFromArgs(args);
    t.equal(result, undefined);
    t.end();
  }
);

t.test(
  "getCallbackFunctionFromArgs should return the last argument if multiple functions are passed",
  (t) => {
    const callback1 = () => {};
    const callback2 = () => {};
    const args = [1, "string", callback1, callback2];
    const result = getCallbackFunctionFromArgs(args);
    t.equal(result, callback2);
    t.end();
  }
);

t.test(
  "getCallbackFunctionFromArgs should return undefined for an empty array",
  (t) => {
    const args: any[] = [];
    const result = getCallbackFunctionFromArgs(args);
    t.equal(result, undefined);
    t.end();
  }
);

t.test(
  "getCallbackFunctionFromArgs should return undefined if all arguments are non-functions",
  (t) => {
    const args = [1, "string", true, null, {}];
    const result = getCallbackFunctionFromArgs(args);
    t.equal(result, undefined);
    t.end();
  }
);

t.test(
  "getCallbackFunctionFromArgs should return undefined if last argument is not a function, even if an earlier argument is",
  (t) => {
    const callback = () => {};
    const args = [1, callback, { options: true }];
    const result = getCallbackFunctionFromArgs(args);
    t.equal(result, undefined);
    t.end();
  }
);
