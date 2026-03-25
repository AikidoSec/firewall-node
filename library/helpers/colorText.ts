type Color = "red";

/**
 * Wraps text in ANSI escape codes if the terminal supports color.
 * Returns the text unstyled otherwise.
 */
export function colorText(color: Color, text: string): string {
  if (!canColor()) {
    return text;
  }

  return `${escapeCode(color)}${text}\x1b[0m`;
}

function escapeCode(color: Color): string {
  switch (color) {
    case "red":
      return "\x1b[31m";
  }
}

function canColor(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR === "0") return false;
  if (process.env.FORCE_COLOR) return true;
  return !!process.stdout.isTTY;
}
