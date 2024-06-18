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
  const lowerCasePath = filePath.toLowerCase();
  const lowerCaseUserInput = userInput.toLowerCase();
  for (const dangerousStart of dangerousPathStarts) {
    if (
      lowerCasePath.startsWith(dangerousStart) &&
      lowerCasePath.startsWith(lowerCaseUserInput)
    ) {
      return true;
    }
  }
  return false;
}
