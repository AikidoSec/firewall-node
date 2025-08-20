const fileExtensions = new Set<string>([
  "env",
  "bashrc",
  "bak",
  "sql",
  "sqlite",
  "db",
  "npmrc",
  "zshrc",
]);

const filenames = new Set<string>([
  ".gitlab-ci.yml",
  ".travis.yml",
  ".config",
  ".config.json",
  ".config.yml",
  ".config.yaml",
  ".config.xml",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "package-lock.json",
  "package.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "wp-config.php",
  "aws-key.yaml",
  "aws-key.yml",
]);

const directories = new Set<string>([
  ".git",
  ".aws",
  ".ssh",
  ".circleci",
  ".github",
  ".docker",
  ".npm",
  ".svn",
  ".vscode",
  ".idea",
]);

export function isWebScanPath(path: string): boolean {
  const segments = path.split("/");
  const filename = segments.pop();

  if (filename) {
    // Check file name
    if (filenames.has(filename)) {
      return true;
    }

    if (filename.includes(".")) {
      const ext = filename.split(".").pop();

      // Check file extension
      if (ext && fileExtensions.has(ext)) {
        return true;
      }
    }
  }

  // Check all directory names
  for (const dir of segments) {
    if (directories.has(dir)) {
      return true;
    }
  }

  return false;
}
