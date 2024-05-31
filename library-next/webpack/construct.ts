import { isAbsolute, join, normalize as normalizePath, resolve } from "path";
import {
  LoaderOptions,
  NextConfigObject,
  WebpackConfigFunction,
} from "../types";
import { existsSync, lstatSync } from "fs";

export function constructWebpackConfigFunction(
  nextConfig: NextConfigObject
): WebpackConfigFunction {
  if (nextConfig.webpack) {
    // Todo support user defined webpack config
    throw new Error("Webpack config is not allowed in next.config.js");
  }

  return (config, context) => {
    if (!context.isServer) {
      // We only want to modify the server config
      return config;
    }

    const projectDir = context.dir;
    let pagesDir: string | null = null;
    let appDir: string | null = null;

    const rootPagesDir = join(projectDir, "pages");
    const srcPagesDir = join(projectDir, "src", "pages");
    if (existsSync(rootPagesDir) && lstatSync(rootPagesDir).isDirectory()) {
      pagesDir = rootPagesDir;
    } else if (
      existsSync(srcPagesDir) &&
      lstatSync(srcPagesDir).isDirectory()
    ) {
      pagesDir = srcPagesDir;
    }
    if (!pagesDir) {
      throw new Error("Could not find pages directory");
    }

    const rootAppDir = join(projectDir, "app");
    const srcAppDir = join(projectDir, "src", "app");
    if (existsSync(rootAppDir) && lstatSync(rootAppDir).isDirectory()) {
      appDir = rootAppDir;
    } else if (existsSync(srcAppDir) && lstatSync(srcAppDir).isDirectory()) {
      appDir = srcAppDir;
    }
    if (!appDir) {
      throw new Error("Could not find app directory");
    }

    const pageExtensions = nextConfig.pageExtensions || [
      "tsx",
      "ts",
      "jsx",
      "js",
    ];

    const loaderOptions: LoaderOptions = {
      appDir,
      pagesDir,
      pageExtensions,
      nextRuntime: context.nextRuntime,
      isDev: context.dev,
    };

    const normalizeResourcePath = (path: string) => {
      if (isAbsolute(path)) {
        return normalizePath(path);
      }
      return normalizePath(join(projectDir, path));
    };

    const isRouteHandler = (path: string) => {
      const normalizedPath = normalizeResourcePath(path);
      return (
        // Todo check allowed cases
        appDir &&
        normalizedPath.startsWith(appDir) &&
        /[\\/]route\.(js|jsx|ts|tsx)$/.test(normalizedPath)
      );
    };

    config.module.rules.unshift({
      test: isRouteHandler,
      use: [
        {
          loader: resolve(__dirname, "loader.js"),
          options: {
            ...loaderOptions,
            type: "route-handler",
          },
        },
      ],
    });

    return config;
  };
}
