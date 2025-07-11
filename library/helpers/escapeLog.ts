/**
 * Remove new line characters and escape backticks from a log message.
 *
 * Also truncates the log message to a maximum length.
 */
export function escapeLog(log: string | undefined, maxLength = 256): string {
  if (!log || typeof log !== "string") {
    return "";
  }

  if (log.length > maxLength) {
    log = log.slice(0, maxLength) + "...";
  }

  return log.replace(/\n/g, " ").replace(/[`"]/g, "'");
}
