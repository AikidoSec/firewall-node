import type { Handler } from "aws-lambda";
import { lambda, setToken } from "../agent/protect";

type LambdaWrapper = ((handler: Handler) => Handler) & {
  setToken: typeof setToken;
};

const wrapper = lambda() as LambdaWrapper;
wrapper.setToken = setToken;

export = wrapper;
