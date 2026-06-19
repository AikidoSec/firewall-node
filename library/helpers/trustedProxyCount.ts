export function getTrustedProxyCount(): number {
  const val = process.env.AIKIDO_TRUSTED_PROXY_COUNT;
  if (!val) {
    return 1;
  }

  const n = parseInt(val, 10);
  if (isNaN(n) || n < 1) {
    return 1;
  }

  return n;
}
