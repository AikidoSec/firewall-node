export function isLocalhostIP(ip: string) {
  return ["127.0.0.1", "::ffff:127.0.0.1", "::1"].includes(ip);
}
