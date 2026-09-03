import * as t from "tap";
import { runWithContext, type Context } from "../agent/Context";
import { Zlib } from "./Zlib";
import { isPackageInstalled } from "../helpers/isPackageInstalled";
import { createTestAgent } from "../helpers/createTestAgent";
import { startTestAgent } from "../helpers/startTestAgent";
import { getSemverNodeVersion } from "../helpers/getNodeVersion";
import { isVersionGreaterOrEqual } from "../helpers/isVersionGreaterOrEqual";
import { join } from "path";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { Readable } from "stream";

const dangerousContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    path: "../../../../etc/passwd",
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

const safeContext: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000/",
  query: {},
  headers: {},
  body: {
    path: "./myfile.txt",
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test(
  "it detects Path Traversal in zlib",
  {
    skip: !isVersionGreaterOrEqual("26.8.0", getSemverNodeVersion()),
  },
  async (t) => {
    startTestAgent({
      wrappers: [new Zlib()],
      rewrite: {},
    });

    const zlib = require("zlib");

    const testZipPath = join(__dirname, "./fixtures/test.zip");

    await runWithContext(dangerousContext, async () => {
      const zipFile = await zlib.ZipFile.open(testZipPath);

      const err1 = t.throws(() => zipFile.add("../../../../etc/passwd"));
      t.ok(err1 instanceof Error);
      if (err1 instanceof Error) {
        t.match(
          err1.message,
          /Zen has blocked a path traversal attack: node:zlib.ZipFile.add\(/
        );
      }

      const err2 = t.throws(() => zipFile.addSync("../../../../etc/passwd"));
      t.ok(err2 instanceof Error);
      if (err2 instanceof Error) {
        t.match(
          err2.message,
          /Zen has blocked a path traversal attack: node:zlib.ZipFile.addSync/
        );
      }

      await zipFile.close();
    });

    runWithContext(dangerousContext, () => {
      const err = t.throws(() => zlib.ZipFile.open("../../../../etc/passwd"));
      t.ok(err instanceof Error);
      if (err instanceof Error) {
        t.match(
          err.message,
          /Zen has blocked a path traversal attack: node:zlib.ZipFile.open\(/
        );
      }
    });

    runWithContext(dangerousContext, () => {
      const err = t.throws(() =>
        zlib.ZipFile.openSync("../../../../etc/passwd")
      );
      t.ok(err instanceof Error);
      if (err instanceof Error) {
        t.match(
          err.message,
          /Zen has blocked a path traversal attack: node:zlib.ZipFile.openSync/
        );
      }
    });

    runWithContext(dangerousContext, () => {
      const buffer = readFileSync(testZipPath);
      const zipBuffer = new zlib.ZipBuffer(buffer);

      const err1 = t.throws(() =>
        zipBuffer.add("../../../../etc/passwd", Buffer.from("data"))
      );
      t.ok(err1 instanceof Error);
      if (err1 instanceof Error) {
        t.match(
          err1.message,
          /Zen has blocked a path traversal attack: node:zlib.ZipBuffer.add\(/
        );
      }

      const err2 = t.throws(() =>
        zipBuffer.addSync("../../../../etc/passwd", Buffer.from("data"))
      );
      t.ok(err2 instanceof Error);
      if (err2 instanceof Error) {
        t.match(
          err2.message,
          /Zen has blocked a path traversal attack: node:zlib.ZipBuffer.addSync\(/
        );
      }
    });

    runWithContext(dangerousContext, () => {
      const err1 = t.throws(() =>
        zlib.ZipEntry.create("../../../../etc/passwd", Buffer.from("data"))
      );
      t.ok(err1 instanceof Error);
      if (err1 instanceof Error) {
        t.match(
          err1.message,
          /Zen has blocked a path traversal attack: node:zlib.ZipEntry.create\(/
        );
      }

      const err2 = t.throws(() =>
        zlib.ZipEntry.createSync("../../../../etc/passwd", Buffer.from("data"))
      );
      t.ok(err2 instanceof Error);
      if (err2 instanceof Error) {
        t.match(
          err2.message,
          /Zen has blocked a path traversal attack: node:zlib.ZipEntry.createSync\(/
        );
      }

      const err3 = t.throws(() =>
        zlib.ZipEntry.createSymlink("../../../../etc/passwd", "/tmp/target")
      );
      t.ok(err3 instanceof Error);
      if (err3 instanceof Error) {
        t.match(
          err3.message,
          /Zen has blocked a path traversal attack: node:zlib.ZipEntry.createSymlink\(/
        );
      }

      const err4 = t.throws(() =>
        zlib.ZipEntry.createSymlink("safe-link.txt", "../../../../etc/passwd")
      );
      t.ok(err4 instanceof Error);
      if (err4 instanceof Error) {
        t.match(
          err4.message,
          /Zen has blocked a path traversal attack: node:zlib.ZipEntry.createSymlink\(/
        );
      }
    });
  }
);

t.test(
  "it does not block normal zip usage",
  {
    skip: !isVersionGreaterOrEqual("26.8.0", getSemverNodeVersion()),
  },
  async (t) => {
    startTestAgent({
      wrappers: [new Zlib()],
      rewrite: {},
    });

    const zlib = require("zlib");
    const testZipPath = join(__dirname, "./fixtures/test.zip");

    await runWithContext(safeContext, async () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "zen-zlib-test-"));
      const tmpZipPath = join(tmpDir, "test.zip");
      copyFileSync(testZipPath, tmpZipPath);

      try {
        const zipFile = await zlib.ZipFile.open(tmpZipPath, {
          writable: true,
        });
        t.ok(zipFile.writable);

        await zipFile.add("hello.txt", Buffer.from("hello"));
        zipFile.addSync("world.txt", Buffer.from("world"));

        t.ok(zipFile.has("hello.txt"));
        t.ok(zipFile.has("world.txt"));
        t.equal(zipFile.getSync("hello.txt").contentSync().toString(), "hello");
        t.equal(zipFile.getSync("world.txt").contentSync().toString(), "world");

        await zipFile.close();
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    runWithContext(safeContext, () => {
      const zipFile = zlib.ZipFile.openSync(testZipPath);
      t.ok(zipFile.has("helloWorld.js"));
      zipFile.closeSync();
    });

    await runWithContext(safeContext, async () => {
      const buffer = readFileSync(testZipPath);
      const zipBuffer = new zlib.ZipBuffer(buffer);

      await zipBuffer.add("hello.txt", Buffer.from("hello"));
      zipBuffer.addSync("world.txt", Buffer.from("world"));

      t.ok(zipBuffer.has("hello.txt"));
      t.ok(zipBuffer.has("world.txt"));
      const entry = await zipBuffer.get("hello.txt");
      t.equal(entry.contentSync().toString(), "hello");

      const outBuffer = await zipBuffer.toBuffer();
      t.ok(Buffer.isBuffer(outBuffer));

      const outBufferSync = zipBuffer.toBufferSync();
      t.ok(Buffer.isBuffer(outBufferSync));
    });

    await runWithContext(safeContext, async () => {
      const created = await zlib.ZipEntry.create("a.txt", Buffer.from("a"));
      t.equal(created.name, "a.txt");
      t.equal(created.contentSync().toString(), "a");

      const createdSync = zlib.ZipEntry.createSync("b.txt", Buffer.from("b"));
      t.equal(createdSync.name, "b.txt");
      t.equal(createdSync.contentSync().toString(), "b");

      const streamed = await zlib.ZipEntry.createStream(
        "c.txt",
        Readable.from([Buffer.from("c")])
      );
      t.equal(streamed.name, "c.txt");

      const symlink = zlib.ZipEntry.createSymlink("d.txt", "target.txt");
      t.equal(symlink.name, "d.txt");
      t.ok(symlink.isSymlink);
    });
  }
);
