// Checks if its an CI Action that is running in the AikidoSec/firewall-node repository
export function isAikidoCI(): boolean {
  return (
    process.env.GITHUB_ACTION_REPOSITORY?.toLowerCase() ===
    "aikidosec/firewall-node"
  );
}
