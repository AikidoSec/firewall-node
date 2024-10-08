import { isAbsolute, resolve } from "path";
import { isWrapped } from "../../helpers/wrap";

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
const dangerousPathStarts = [...linuxRootFolders, "c:/", "c:\\"];

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
  for (const dangerousStart of dangerousPathStarts) {
    if (
      normalizedPath.startsWith(dangerousStart) &&
      normalizedPath.startsWith(normalizedUserInput)
    ) {
      return true;
    }
  }
  return false;
}
