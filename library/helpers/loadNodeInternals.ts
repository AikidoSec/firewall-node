import { existsSync } from "node:fs";
import { join } from "node:path";
import { getLibraryRoot } from "./getLibraryRoot";
import { getMajorNodeVersion } from "./getNodeVersion";
import { isMusl } from "./isMusl";

export type NativeIPMatcher = {
  has(network: string): boolean;
};

export type NodeInternals = {
  setCodeGenerationCallback?: (
    callback: (code: string) => string | undefined
  ) => void;
  createIPMatcher?: (networks: string[]) => Promise<NativeIPMatcher>;
};

export type LoadNodeInternalsResult = {
  bindings: NodeInternals | undefined;
  error: Error | undefined;
};

export function loadNodeInternals(): LoadNodeInternalsResult {
  const majorVersion = getMajorNodeVersion();
  const arch = process.arch;
  const platform = process.platform;
  const nodeInternalsDir = join(getLibraryRoot(), "node_internals");
  let binaryPath = join(
    nodeInternalsDir,
    `zen-internals-node-${platform}-${arch}-node${majorVersion}.node`
  );

  if (isMusl()) {
    binaryPath = join(
      nodeInternalsDir,
      `zen-internals-node-${platform}-${arch}-musl-node${majorVersion}.node`
    );
  }

  if (!existsSync(binaryPath)) {
    return { bindings: undefined, error: undefined };
  }

  try {
    return {
      bindings: require(binaryPath) as NodeInternals,
      error: undefined,
    };
  } catch (error) {
    return {
      bindings: undefined,
      error: error as Error,
    };
  }
}
