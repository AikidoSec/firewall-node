import { isAbsolute, resolve } from "path";
import { isWrapped } from "../../helpers/wrap";
import { isWindows } from "../../helpers/isWindows";

const linuxRootFolders = [
  "/bin/",
  "/boot/",
  "/dev/",
  "/etc/",
  "/home/",
  "/init/",
  "/lib/",
  "/media/",
  "/mnt/",
  "/opt/",
  "/proc/",
  "/root/",
  "/run/",
  "/sbin/",
  "/srv/",
  "/sys/",
  "/tmp/",
  "/usr/",
  "/var/",
];

export function startsWithUnsafePath(filePath: string, userInput: string) {
  // Check if path is relative (not absolute or drive letter path)
  // Required because resolve will build absolute paths from relative paths
  if (!isAbsolute(filePath) || !isAbsolute(userInput)) {
    return false;
  }

  let origResolve = resolve;
  if (isWrapped(resolve)) {
    origResolve = resolve.__original;
  }

  const normalizedPath = origResolve(filePath).toLowerCase();
  const normalizedUserInput = origResolve(userInput).toLowerCase();

  if (!normalizedPath.startsWith(normalizedUserInput)) {
    return false;
  }

  if (isWindows) {
    return startsWithUnsafePathWindows(userInput);
  }

  return startsWithUnsafePathPosix(normalizedPath, userInput);
}

export function startsWithUnsafePathPosix(
  normalizedPath: string,
  userInput: string
) {
  if (
    linuxRootFolders.some(
      (folder) =>
        // If the user input is the same as the dangerous start, we don't want to flag it to prevent false positives
        // e.g. if user input is /etc/ and the path is /etc/passwd, we don't want to flag it, as long as the
        // user input does not contain a subdirectory or filename
        normalizedPath.startsWith(folder) &&
        userInput !== folder &&
        userInput !== folder.slice(0, -1)
    )
  ) {
    return true;
  }

  return false;
}

export function startsWithUnsafePathWindows(userInput: string) {
  // We already know that the path starts with the user input and that the user input is a absolute path (e.g. C:\ or /)

  // Count all non-empty segments in the user input
  const pathSegmentCount = userInput
    .split(/[\\\/]/)
    .filter((segment) => segment).length;

  // Require at least 2 segments to be considered unsafe, e.g. C:\test or /etc/abc, but not C:\ or /etc
  return pathSegmentCount > 1;
}
