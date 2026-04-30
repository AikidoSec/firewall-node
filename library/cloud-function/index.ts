import type { HttpFunction } from "@google-cloud/functions-framework";
import { cloudFunction, setToken } from "../agent/protect";

type CloudFunctionWrapper = ((handler: HttpFunction) => HttpFunction) & {
  setToken: typeof setToken;
};

const wrapper = cloudFunction() as CloudFunctionWrapper;
wrapper.setToken = setToken;

export = wrapper;
