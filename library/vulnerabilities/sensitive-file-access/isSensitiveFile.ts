const forbiddenFileNames = [
  "\\.env[^/]*",
  "\\.bashrc",
  "\\.gitlab-ci.yml",
  "\\.travis.yml",
  "[^/]*\\.(?:sql|sqlite|db)",
  "Dockerfile",
  "docker-compose(?:[^/]*)?\\.(?:yml|yaml)",

  // Node.js specific
  "package-lock\\.json",
  "package\\.json",
  "npm-shrinkwrap\\.json",
  "yarn\\.lock",
  "\\.npmrc",
];
const forbiddenDirectories = [
  "\\.git",
  "\\.aws",
  "\\.ssh",
  "\\.circleci",
  "\\.github",
  "\\.docker",
  "\\.svn",
  "\\.hg",
  "\\.idea",
  "\\.vscode",
];

const forbiddenFileNamesPattern = `(?:.*/(?:${forbiddenFileNames.join("|")}))`;
const forbiddenDirectoriesPattern = `(?:.*/(?:${forbiddenDirectories.join("|")})(?:/.*)?)`;

const regex = new RegExp(
  `^(?:${forbiddenFileNamesPattern}|${forbiddenDirectoriesPattern})$`,
  "i"
);

/**
 * Check if a given url path (absolute) is a sensitive file or directory
 */
export function isSensitiveFile(path: string): boolean {
  if (path.length <= 1) {
    return false;
  }

  return regex.test(path);
}
