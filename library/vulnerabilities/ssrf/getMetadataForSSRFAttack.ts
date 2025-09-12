export function getMetadataForSSRFAttack({
  hostname,
  port,
  privateIP,
}: {
  hostname: string;
  port: number | undefined;
  privateIP?: string;
}): Record<string, string> {
  const metadata: Record<string, string> = {
    hostname: hostname,
  };

  if (typeof port === "number") {
    metadata.port = port.toString();
  }

  if (privateIP) {
    metadata.privateIP = privateIP;
  }

  return metadata;
}
