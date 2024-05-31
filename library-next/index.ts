import { NextConfigObject } from "./types";
import { constructWebpackConfigFunction } from "./webpack/construct";

export function withAikido(nextConfig: NextConfigObject) {
  // Todo nextConfig may be a function?
  // Todo check next js version

  nextConfig.webpack = constructWebpackConfigFunction(nextConfig);
  return nextConfig;
}
