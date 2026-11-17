// Control characters (incl. \r, \n, ESC), DEL, C1 controls, Unicode line/paragraph separators, backticks and double quotes
const UNSAFE_LOG_CHARS = /[\p{Cc}\u{2028}\u{2029}`"]/gu;

/**
 * Replace control characters (new lines, carriage returns, ANSI escape bytes, ...)
 * and escape backticks and double quotes in a log message.
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

  return log.replace(UNSAFE_LOG_CHARS, (char) => {
    if (char === "`" || char === '"') {
      return "'";
    }
    return " ";
  });
}
