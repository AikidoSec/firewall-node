const BOX_CHARS = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
};

const TEXT_WIDTH = 64;
const PADDING = 2;
const INNER_WIDTH = TEXT_WIDTH + PADDING * 2;

export function warnBox(message: string): string {
  const lines = wordWrap(message, TEXT_WIDTH);

  const title = "AIKIDO";
  const top =
    BOX_CHARS.topLeft +
    BOX_CHARS.horizontal.repeat(PADDING) +
    title +
    BOX_CHARS.horizontal.repeat(INNER_WIDTH - PADDING - title.length) +
    BOX_CHARS.topRight;
  const bottom =
    BOX_CHARS.bottomLeft +
    BOX_CHARS.horizontal.repeat(INNER_WIDTH) +
    BOX_CHARS.bottomRight;
  const empty =
    BOX_CHARS.vertical + " ".repeat(INNER_WIDTH) + BOX_CHARS.vertical;

  const content = lines.map((line) => {
    const pad = INNER_WIDTH - PADDING - line.length;
    return (
      BOX_CHARS.vertical +
      " ".repeat(PADDING) +
      line +
      " ".repeat(pad) +
      BOX_CHARS.vertical
    );
  });

  return ["", top, empty, ...content, empty, bottom, ""].join("\n");
}

function wordWrap(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}
