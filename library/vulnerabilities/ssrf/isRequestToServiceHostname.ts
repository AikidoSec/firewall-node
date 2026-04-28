// e.g. "discord-bot" or "my_service" or "BACKEND"
const SERVICE_HOSTNAME_PATTERN = /^[a-z-_]+$/;

const NOT_SERVICE_HOSTNAMES = [
  "localhost",
  "localdomain",

  // On GCP "metadata" resolves to the IMDS service (metadata.google.internal)
  // See https://stackoverflow.com/questions/23362887/can-you-get-external-ip-address-from-within-a-google-compute-vm-instance
  // See https://cloud.google.com/compute/docs/internal-dns
  "metadata",
];

export function isRequestToServiceHostname(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();

  if (NOT_SERVICE_HOSTNAMES.includes(lowerHostname)) {
    return false;
  }

  return SERVICE_HOSTNAME_PATTERN.test(lowerHostname);
}
