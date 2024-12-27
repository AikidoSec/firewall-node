/**
 * Remove new line characters and escape backticks from a log message.
 */
export function escapeLog(log: string | undefined): string {
  if (!log || typeof log !== "string") {
    return "";
  }

  return log.replace(/\n/g, " ").replace(/[`"]/g, "'");
}
