const forbiddenFileNames = [".env", ".bashrc"];
const forbiddenDirectories = [".git", ".aws"];

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
