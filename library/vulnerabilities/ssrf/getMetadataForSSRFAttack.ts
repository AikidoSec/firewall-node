export function getMetadataForSSRFAttack({
  hostname,
  port,
}: {
  hostname: string;
  port: number | undefined;
}): Record<string, string> {
  const metadata: Record<string, string> = {
    hostname: hostname,
  };

  if (typeof port === "number") {
    metadata.port = port.toString();
  }

  return metadata;
}
