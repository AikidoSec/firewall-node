const dangerousPathParts = ["../", "..\\"];
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
const dangerousPathStarts = [...linuxRootFolders, "C:/", "c:/", "C:\\", "c:\\"];

export function containsUnsafePathParts(filePath: string) {
  for (const dangerousPart of dangerousPathParts) {
    if (filePath.includes(dangerousPart)) {
      return true;
    }
    for (const dangerousStart of dangerousPathStarts) {
      if (filePath.startsWith(dangerousStart)) {
        return true;
      }
    }
  }

  return false;
}
