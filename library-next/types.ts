export type NextConfigObject = {
  // Custom webpack options
  webpack?: unknown | null;
  pageExtensions?: string[];
};

export type WebpackConfigFunction = (
  config: WebpackConfigObject,
  options: BuildContext
) => WebpackConfigObject;
export type WebpackConfigObject = any;

export type BuildContext = {
  buildId: string;
  dev: boolean;
  isServer: boolean;
  nextRuntime?: "nodejs" | "edge";
  defaultLoaders: object;
  dir: string;
};

export type LoaderOptions = {
  appDir: string;
  type?: "route-handler";
  pagesDir: string;
  pageExtensions: string[];
  nextRuntime?: "nodejs" | "edge";
  isDev: boolean;
};

export type RouteHandler = (...args: unknown[]) => unknown;
