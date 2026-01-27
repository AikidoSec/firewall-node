import { isAbsolute, resolve } from "path";
import { isWrapped, originalSymbol } from "../../helpers/wrap";

const rootFolders = [
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
  // macOS specific
  "/applications/",
  "/cores/",
  "/library/",
  "/private/",
  "/users/",
  "/system/",
  "/volumes/",
].map((path) => path.toLowerCase());

const dangerousPathStarts = [...rootFolders, "c:/", "c:\\"];

export function startsWithUnsafePath(filePath: string, userInput: string) {
  // Check if path is relative (not absolute or drive letter path)
  // Required because resolve will build absolute paths from relative paths
  if (!isAbsolute(filePath) || !isAbsolute(userInput)) {
    return false;
  }

  let origResolve = resolve;
  if (isWrapped(resolve)) {
    origResolve = resolve[originalSymbol];
  }

  const normalizedPath = origResolve(filePath).toLowerCase();
  const normalizedUserInput = origResolve(userInput).toLowerCase();

  for (const dangerousStart of dangerousPathStarts) {
    if (
      normalizedPath.startsWith(dangerousStart) &&
      normalizedPath.startsWith(normalizedUserInput)
    ) {
      // If the user input is the same as the dangerous start, we don't want to flag it to prevent false positives
      // e.g. if user input is /etc/ and the path is /etc/passwd, we don't want to flag it, as long as the
      // user input does not contain a subdirectory or filename
      if (
        userInput === dangerousStart ||
        userInput === dangerousStart.slice(0, -1)
      ) {
        return false;
      }
      return true;
    }
  }
  return false;
}
