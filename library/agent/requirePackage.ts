/**
 * This function exists to dynamically require a package.
 * Webpack does not support expressions in require statements, so this function is used to work around that.
 * @param pkgName
 */
export function dynamicRequire(pkgName: string) {
  switch (pkgName) {
    case "child_process":
      return require("child_process");
    case "fs":
      return require("fs");
    case "fs/promises":
      return require("fs/promises");
    case "http":
      return require("http");
    case "https":
      return require("https");
    case "dns":
      return require("dns");
    case "dns/promises":
      return require("dns/promises");
    case "path":
      return require("path");
    case "shell-quote":
        return require("shell-quote");
    case "aws-sdk":
        return require("aws-sdk");
    case "mongodb":
        return require("mongodb");
    case "mysql":
        return require("mysql");
    case "mysql2":
        return require("mysql2");
    case "pg":
        return require("pg");
    //case "undici":
        //return require("undici");
    case "express":
        return require("express");
    case "@google-cloud/functions-framework":
        return require("@google-cloud/functions-framework");
    case "@google-cloud/pubsub":
        return require("@google-cloud/pubsub");
    default:
      throw new Error(`Unknown dynamic require for package: ${pkgName}`);
  }
}

/**
 * This function exists to dynamically resolves a package.
 * Webpack does not support expressions in require.resolve statements, so this function is used to work around that.
 * @param pkgName
 */
export function dynamicResolve(pkgName: string) {
  switch (pkgName) {
    case "shell-quote":
      return require.resolve("shell-quote");
    case "aws-sdk":
      return require.resolve("aws-sdk");
    case "mongodb":
      return require.resolve("mongodb");
    case "mysql":
      return require.resolve("mysql");
    case "mysql2":
      return require.resolve("mysql2");
    case "pg":
      return require.resolve("pg");
    //case "undici":
      //return require.resolve("undici");
    case "express":
      return require.resolve("express");
    case "@google-cloud/functions-framework":
      return require.resolve("@google-cloud/functions-framework");
    case "@google-cloud/pubsub":
      return require.resolve("@google-cloud/pubsub");
    default:
      throw new Error(`Unknown dynamic resolve for package: ${pkgName}`);
  }
}

/**
 * This function exists to dynamically require a package.json file of a package.
 * This is done to add support for webpack.
 * @param pkgName
 */
export function dynamicRequirePackageJson(pkgName: string) {
  switch (pkgName) {
    case "express":
        return require("express/package.json");
    case "shell-quote":
        return require("shell-quote/package.json");
    case "aws-sdk":
        return require("aws-sdk/package.json");
    case "mongodb":
        return require("mongodb/package.json");
    case "mysql":
        return require("mysql/package.json");
    case "mysql2":
        return require("mysql2/package.json");
    case "pg":
        return require("pg/package.json");
    case "undici":
        return require("undici/package.json");
    //case "@google-cloud/functions-framework":
        //return require("@google-cloud/functions-framework/package.json");
    case "@google-cloud/pubsub":
        return require("@google-cloud/pubsub/package.json");
    default:
      throw new Error(`Unknown dynamic package json require for package: ${pkgName}`);
  }
}

/**
 * This function wraps the dynamic require for specific files.
 * This is done to add support for webpack.
 * @param path 
 * @returns 
 */
export function dynamicRequireFile(path: string) {
    switch (path) {
        case "mysql/lib/Connection":
            return require("mysql/lib/Connection");
        case "@google-cloud/pubsub/build/src/subscription.js":
            return require("@google-cloud/pubsub/build/src/subscription.js");
        default:
            throw new Error(`Unknown dynamic require for file: ${path}`);
    }
}