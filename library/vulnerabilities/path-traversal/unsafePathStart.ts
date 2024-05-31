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
  const normalizedPath = filePath.replace(/^(\/\.)*/g, "").toLowerCase();
  const normalizedUserInput = userInput.replace(/^(\/\.)*/g, "").toLowerCase();
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
