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

  return isDangerous(normalizedPath, normalizedUserInput);
}

function isDangerous(normalizedPath: string, normalizedUserInput: string) {
  // Check if normalizedPath starts with normalizedUserInput
  if (!normalizedPath.startsWith(normalizedUserInput)) {
    return false;
  }

  const foundLinuxRoot = linuxRootFolders.find((folder) =>
    normalizedPath.startsWith(folder)
  );

  if (foundLinuxRoot) {
    return true;
  }

  // Check for windows drive letter
  if (/^[a-z]:(\\|\/)/i.test(normalizedPath)) {
    return true;
  }

  return false;
}
