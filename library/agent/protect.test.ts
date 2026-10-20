import { readdir, readFile } from "fs/promises";
import { join } from "path";
import * as t from "tap";

// @esm-tests-skip

t.test("check that all sources and sinks are imported", async (t) => {
  // -----

  const skipCheckList = [
    "Function", // Function sink is disabled for now because functionName.constructor === Function is false after patching global
  ];

  const noWrapperAllowList = ["Lambda"];

  // -----

  const sourceText = await readFile(join(__dirname, "protect.ts"), "utf-8");
  const importDeclarations =
    sourceText.match(/import\s+(?:[^'"]|\n)+?\s+from\s+['"][^'"]+['"]/g) || [];

  const getWrappersFunctionContent =
    sourceText
      .match(/export function getWrappers\(\)\s*\{([\s\S]*?)^\}/m)?.[1]
      ?.trim() ?? "";

  const allSourceFiles = await readdir(join(__dirname, "../sources"), {
    withFileTypes: true,
  });

  const allSinkFiles = await readdir(join(__dirname, "../sinks"), {
    withFileTypes: true,
  });

  const allFiles = [...allSourceFiles, ...allSinkFiles]
    .filter(
      (file) =>
        file.isFile() &&
        file.name.endsWith(".ts") &&
        !file.name.endsWith(".test.ts") &&
        !file.name.endsWith(".tests.ts")
    )
    .map((file) => file.name.replace(/\.ts$/, ""));

  for (const file of allFiles) {
    if (skipCheckList.includes(file)) {
      t.comment(`Skipping ${file} as it is in the allowlist.`);
      continue;
    }

    const importDeclaration = importDeclarations.find(
      (declaration) =>
        declaration.includes(`"../sources/${file}"`) ||
        declaration.includes(`"../sinks/${file}"`)
    );

    t.ok(
      importDeclaration,
      `Import for ${file} is missing in protect.ts: ${importDeclaration}`
    );

    if (noWrapperAllowList.includes(file)) {
      t.comment(
        `Skipping getWrappers check for ${file} as it is in the noWrapperAllowList.`
      );
      continue;
    }

    const includesInGetWrappers = getWrappersFunctionContent.includes(
      `new ${file}()`
    );
    t.ok(
      includesInGetWrappers,
      `getWrappers function does not include ${file} in its return value`
    );
  }
});
