import * as t from "tap";
import { getCallbackFunctionFromArgs } from "./getCallbackFunctionFromArgs";

t.test(
  "getCallbackFunctionFromArgs should return the last function argument",
  (t) => {
    const callback = () => {};
    const args = [1, "string", callback, () => {}];
    const result = getCallbackFunctionFromArgs(args);
    t.equal(result, args[3]);
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
  "getCallbackFunctionFromArgs should return the last function argument even if there are multiple",
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
