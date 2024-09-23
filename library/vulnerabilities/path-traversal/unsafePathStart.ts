import { isAbsolute, resolve } from "path";

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
  if (!isAbsolute(filePath)) {
    return false;
  }

  let origResolve = resolve;
  // @ts-expect-error __wrapped is not typed
  if (resolve.__wrapped) {
    // @ts-expect-error Not type safe
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
