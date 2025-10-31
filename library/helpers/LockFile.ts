import { mkdir, open, unlink, type FileHandle } from "fs/promises";
import { setTimeout } from "timers/promises";
import { join } from "path";
import { tmpdir } from "os";
import { isUnitTest } from "./isUnitTest";

const LOCK_DIR = join(tmpdir(), "zen-test-locks");

export class LockFile {
  private handle: FileHandle | null = null;
  private lockFile: string;

  constructor(name: string) {
    if (!isUnitTest()) {
      throw new Error("LockFile can only be used in unit tests");
    }

    this.lockFile = join(LOCK_DIR, `${name}.lock`);
  }

  async acquire(): Promise<void> {
    // Ensure lock directory exists
    await mkdir(LOCK_DIR, { recursive: true });

    // Use wx flag to create file exclusively (fails if file exists)
    const maxRetries = 1000;
    const retryDelay = 100; // 100ms

    for (let i = 0; i < maxRetries; i++) {
      try {
        this.handle = await open(this.lockFile, "wx");
        return; // Lock acquired successfully
      } catch (error: any) {
        if (error.code === "EEXIST") {
          // Lock file exists, wait and retry
          await setTimeout(retryDelay);
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Failed to acquire lock after ${maxRetries} attempts`);
  }

  async release(): Promise<void> {
    if (this.handle) {
      await this.handle.close();
      this.handle = null;
    }

    try {
      await unlink(this.lockFile);
    } catch (error: any) {
      // Ignore ENOENT errors (file already doesn't exist)
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      await this.release();
    }
  }
}
