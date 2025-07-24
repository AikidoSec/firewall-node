// e.g. "discord-bot" or "my_service" or "BACKEND"
const SERVICE_HOSTNAME_PATTERN = /^[a-z-_]+$/;

const SPECIAL_EXCEPTIONS = [
  "localhost",
  "localdomain",

  // On GCP "metadata" resolves to the IMDS service
  // See https://stackoverflow.com/questions/23362887/can-you-get-external-ip-address-from-within-a-google-compute-vm-instance
  // See https://cloud.google.com/compute/docs/internal-dns
  "metadata",
];

export function isRequestToServiceHostname(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();

  if (SPECIAL_EXCEPTIONS.includes(lowerHostname)) {
    return false;
  }

  return SERVICE_HOSTNAME_PATTERN.test(lowerHostname);
}
