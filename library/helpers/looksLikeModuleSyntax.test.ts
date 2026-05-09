import * as t from "tap";
import { looksLikeModuleSyntax } from "./looksLikeModuleSyntax";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

async function createTempFile(content: string, cb: (path: string) => void) {
  const dir = await mkdir(join(tmpdir(), `aikido-test-${performance.now()}`), {
    recursive: true,
  });

  if (!dir) {
    throw new Error("Failed to create temporary directory");
  }

  const filePath = `${dir}/tempFile.js`;
  await writeFile(filePath, content, "utf-8");

  cb(filePath);
  await rm(dir, { recursive: true, force: true });
}

t.test("looksLikeModuleSyntax - detects ESM syntax", async (t) => {
  await createTempFile(`import fs from 'fs';`, async (filePath) => {
    const result = looksLikeModuleSyntax(filePath);
    t.equal(result, true);
  });
});

t.test("looksLikeModuleSyntax - only CommonJS syntax", async (t) => {
  await createTempFile(`const fs = require('fs');`, async (filePath) => {
    const result = looksLikeModuleSyntax(filePath);
    t.equal(result, false);
  });
});

t.test("import is not in the first line", async (t) => {
  await createTempFile(
    `// Some comment\n\nimport fs from 'fs';`,
    async (filePath) => {
      const result = looksLikeModuleSyntax(filePath);
      t.equal(result, true);
    }
  );
});

t.test("only export statement", async (t) => {
  await createTempFile(`export const x = 42;`, async (filePath) => {
    const result = looksLikeModuleSyntax(filePath);
    t.equal(result, true);
  });
});

t.test("empty file", async (t) => {
  await createTempFile(``, async (filePath) => {
    const result = looksLikeModuleSyntax(filePath);
    t.equal(result, false);
  });
});

t.test("no module specific syntax", async (t) => {
  await createTempFile(`console.log('Hello, world!');`, async (filePath) => {
    const result = looksLikeModuleSyntax(filePath);
    t.equal(result, false);
  });
});
