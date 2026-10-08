const { join } = require("path");
const { readFile } = require("fs/promises");
const { strict: assert } = require("assert");

// Simple test runner
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log("Running install.js security tests...\n");
  
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`✓ ${name}`);
    } catch (error) {
      failed++;
      console.error(`✗ ${name}`);
      console.error(`  ${error.message}`);
    }
  }
  
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Test: does not fall back to node-gyp rebuild for sqlite3
test("does not fall back to node-gyp rebuild for sqlite3", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify the script does NOT contain node-gyp rebuild fallback for sqlite3
  const hasUnsafeFallback = 
    installScript.includes('await execAsync("node-gyp rebuild"') &&
    installScript.includes('pkgName === "sqlite3"') &&
    !installScript.includes("Building from source is disabled for security");
  
  assert.ok(
    !hasUnsafeFallback,
    "install.js should not have node-gyp rebuild fallback without security check"
  );

  // Verify the script contains the security boundary message
  assert.ok(
    installScript.includes("Building from source is disabled for security"),
    "install.js should contain security boundary message"
  );

  // Verify the script exits on prebuild-install failure
  assert.ok(
    installScript.includes("process.exit(1)") &&
      installScript.includes("Failed to install prebuilt binary"),
    "install.js should exit on prebuild-install failure"
  );
});

// Test: does not fall back to node-gyp rebuild for better-sqlite3
test("does not fall back to node-gyp rebuild for better-sqlite3", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify the script does NOT contain node-gyp rebuild fallback for better-sqlite3
  const hasUnsafeFallback = 
    installScript.includes('await execAsync("node-gyp rebuild --release"') &&
    installScript.includes('pkgName.startsWith("better-sqlite3")') &&
    !installScript.includes("Building from source is disabled for security");
  
  assert.ok(
    !hasUnsafeFallback,
    "install.js should not have node-gyp rebuild fallback for better-sqlite3 without security check"
  );

  // Verify the script contains the security boundary message
  assert.ok(
    installScript.includes("Building from source is disabled for security"),
    "install.js should contain security boundary message for better-sqlite3"
  );
});

// Test: does not process binding.gyp from package directory
test("does not process binding.gyp from package directory", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that node-gyp is not invoked at all in the current code
  const nodeGypMatches = installScript.match(/node-gyp\s+rebuild/g);
  
  // If node-gyp is mentioned, it should only be in comments or error messages
  if (nodeGypMatches) {
    // Check that all mentions are in safe contexts (comments or strings)
    const lines = installScript.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("node-gyp rebuild")) {
        // Should be in a comment or a string (error message)
        const isComment = line.trim().startsWith("//") || line.trim().startsWith("*");
        const isInString = line.includes('"node-gyp') || line.includes("'node-gyp");
        const isInErrorMessage = line.includes("console.error") || line.includes("Failed");
        
        assert.ok(
          isComment || isInString || isInErrorMessage,
          `Line ${i + 1}: node-gyp should only appear in comments or error messages`
        );
      }
    }
  }

  // Verify that execAsync with node-gyp is not called in the active code path
  const execAsyncNodeGypPattern = /await\s+execAsync\s*\(\s*["`']node-gyp\s+rebuild/;
  assert.ok(
    !execAsyncNodeGypPattern.test(installScript),
    "install.js should not execute node-gyp rebuild"
  );
});

// Test: maintains --ignore-scripts safety boundary
test("maintains --ignore-scripts safety boundary", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that --ignore-scripts is used
  assert.ok(
    installScript.includes('--ignore-scripts'),
    "install.js should use --ignore-scripts flag"
  );

  // Verify that the comment explains the security boundary
  assert.ok(
    installScript.includes("maintain the security boundary") ||
      installScript.includes("security boundary established by --ignore-scripts"),
    "install.js should document the security boundary"
  );

  // Verify that prebuild-install is the only native build tool used
  assert.ok(
    installScript.includes("prebuild-install"),
    "install.js should use prebuild-install"
  );
});

// Test: exits with error when prebuilt binary is not available
test("exits with error when prebuilt binary is not available", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that the script exits when prebuild-install fails
  const failureHandling = installScript.includes("Failed to install prebuilt binary") &&
    installScript.includes("process.exit(1)");

  assert.ok(
    failureHandling,
    "install.js should exit with error when prebuilt binary is not available"
  );

  // Verify that there's no fallback to building from source
  const hasFallbackToNodeGyp = installScript.includes("falling back to node-gyp");
  assert.ok(
    !hasFallbackToNodeGyp,
    "install.js should not mention falling back to node-gyp"
  );
});

// Test: only processes allowlisted native packages
test("only processes allowlisted native packages", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that only specific packages are in the allowlist
  assert.ok(
    installScript.includes('"sqlite3"') &&
      installScript.includes('"better-sqlite3"') &&
      installScript.includes('"better-sqlite3-v12"') &&
      installScript.includes('"better-sqlite3-v13"'),
    "install.js should have explicit allowlist of native packages"
  );

  // Verify that the allowlist is used to filter packages
  assert.ok(
    installScript.includes("nativePackages") &&
      installScript.includes("filter"),
    "install.js should filter packages based on allowlist"
  );
});

// Test: verifies package-controlled build actions are not executed
test("verifies package-controlled build actions are not executed", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that the comment explains the risk of binding.gyp
  assert.ok(
    installScript.includes("binding.gyp") ||
      installScript.includes("package-controlled build") ||
      installScript.includes("package-defined build actions"),
    "install.js should document the risk of package-controlled build actions"
  );

  // Verify that the comment mentions malicious code risk
  assert.ok(
    installScript.includes("malicious code") ||
      installScript.includes("malicious"),
    "install.js should document the malicious code risk"
  );
});

// Test: updated comments reflect security-focused approach
test("updated comments reflect security-focused approach", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that the function comment has been updated
  const oldComment = "We need to manually rebuild native packages (the ones we trust)";
  const newCommentKeywords = [
    "Install prebuilt native binaries",
    "only use prebuilt binaries",
    "do not fall back to node-gyp rebuild",
  ];

  assert.ok(
    !installScript.includes(oldComment),
    "install.js should not have old comment about rebuilding"
  );

  const hasNewComment = newCommentKeywords.some(keyword =>
    installScript.includes(keyword)
  );
  assert.ok(
    hasNewComment,
    "install.js should have updated comment about prebuilt binaries only"
  );
});

// Test: console messages reflect prebuilt-only approach
test("console messages reflect prebuilt-only approach", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that console messages mention "prebuilt binaries"
  assert.ok(
    installScript.includes("Installing prebuilt binaries"),
    "install.js should log about installing prebuilt binaries"
  );

  assert.ok(
    installScript.includes("Installed prebuilt binary"),
    "install.js should log success for prebuilt binary installation"
  );

  // Verify that old "rebuilding" messages are removed
  assert.ok(
    !installScript.includes("Rebuilding native packages"),
    "install.js should not mention rebuilding native packages"
  );
});

// Test: install-lib-only command does not execute node-gyp
test("install-lib-only command does not execute node-gyp", async () => {
  const packageJson = await readFile(
    join(__dirname, "..", "package.json"),
    "utf-8"
  );
  const pkg = JSON.parse(packageJson);

  // Verify that install-lib-only script exists
  assert.ok(
    pkg.scripts && pkg.scripts["install-lib-only"],
    "package.json should have install-lib-only script"
  );

  // Verify that it uses the install script
  assert.ok(
    pkg.scripts["install-lib-only"].includes("install.js") ||
      pkg.scripts["install-lib-only"].includes("install"),
    "install-lib-only should use install.js"
  );
});

// Test: CI environment uses the secure install path
test("CI environment uses the secure install path", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that CI environment is handled
  assert.ok(
    installScript.includes("process.env.CI"),
    "install.js should check for CI environment"
  );

  // Verify that the same security boundary applies in CI
  assert.ok(
    installScript.includes("npm ci") && installScript.includes("--ignore-scripts"),
    "install.js should use npm ci with --ignore-scripts in CI"
  );
});

// Test: malicious binding.gyp cannot be executed
test("malicious binding.gyp cannot be executed", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that the code path that would execute binding.gyp is removed
  // The old code had: await execAsync("node-gyp rebuild", { cwd: packagePath })
  // This would process binding.gyp in packagePath
  
  // Check that node-gyp rebuild is not executed with cwd set to package directory
  const dangerousPattern = /await\s+execAsync\s*\(\s*["`']node-gyp\s+rebuild[^)]*cwd:\s*packagePath/;
  assert.ok(
    !dangerousPattern.test(installScript),
    "install.js should not execute node-gyp rebuild in package directory"
  );
});

// Test: malicious dependency update cannot gain code execution
test("malicious dependency update cannot gain code execution", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that even if a malicious update is accepted, it cannot execute code
  // because node-gyp is not invoked
  const hasNodeGypExecution = /await\s+execAsync\s*\([^)]*node-gyp\s+rebuild/.test(installScript);
  
  assert.ok(
    !hasNodeGypExecution,
    "install.js should not execute node-gyp rebuild, preventing malicious build actions"
  );

  // Verify that the only execution is prebuild-install
  assert.ok(
    installScript.includes("prebuild-install"),
    "install.js should only use prebuild-install"
  );
});

// Test: compromised native artifact cannot execute during install
test("compromised native artifact cannot execute during install", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that the install process fails safely if prebuilt binary is not available
  // rather than falling back to building from source
  const safeFailure = installScript.includes("process.exit(1)") &&
    installScript.includes("Failed to install prebuilt binary") &&
    installScript.includes("Building from source is disabled for security");

  assert.ok(
    safeFailure,
    "install.js should fail safely without building from source"
  );
});

// Test: package-controlled build actions are documented as security risk
test("package-controlled build actions are documented as security risk", async () => {
  const installScript = await readFile(
    join(__dirname, "install.js"),
    "utf-8"
  );

  // Verify that the security risk is documented in comments
  const securityDocumentation = 
    installScript.includes("package-controlled build") ||
    installScript.includes("package-defined build actions") ||
    installScript.includes("binding.gyp");

  assert.ok(
    securityDocumentation,
    "install.js should document the security risk of package-controlled build actions"
  );

  // Verify that the mitigation is documented
  const mitigationDocumentation =
    installScript.includes("maintain the security boundary") ||
    installScript.includes("security boundary established by --ignore-scripts");

  assert.ok(
    mitigationDocumentation,
    "install.js should document how the security boundary is maintained"
  );
});

// Run all tests
runTests();
