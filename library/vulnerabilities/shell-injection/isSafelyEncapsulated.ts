const dangerousCharsInsideDoubleQuotes = ["$", "`", "\\", "!"];

type QuoteRegion = {
  start: number;
  end: number;
  quoteChar: string;
};

// Walks the command and returns all properly closed single-quote and
// double-quote regions. Inside double quotes, backslash escapes are
// respected (per POSIX/bash rules); single quotes have no escape mechanism.
function parseQuoteRegions(command: string): QuoteRegion[] {
  const regions: QuoteRegion[] = [];
  let i = 0;
  while (i < command.length) {
    const ch = command[i];
    if (ch === "'" || ch === '"') {
      const start = i;
      i++;
      while (i < command.length && command[i] !== ch) {
        if (ch === '"' && command[i] === "\\") {
          i++;
        }
        i++;
      }
      if (i < command.length) {
        regions.push({ start, end: i, quoteChar: ch });
      }
      i++;
    } else {
      i++;
    }
  }
  return regions;
}

export function isSafelyEncapsulated(command: string, userInput: string) {
  const regions = parseQuoteRegions(command);
  const hasDangerousChars = dangerousCharsInsideDoubleQuotes.some((dc) =>
    userInput.includes(dc)
  );

  let idx = 0;
  while (true) {
    const pos = command.indexOf(userInput, idx);
    if (pos === -1) {
      break;
    }
    const absStart = pos;
    const absEnd = pos + userInput.length - 1;

    let inSafeQuote = false;
    for (const region of regions) {
      if (absStart > region.start && absEnd < region.end) {
        if (region.quoteChar === "'") {
          inSafeQuote = true;
          break;
        }
        if (region.quoteChar === '"' && !hasDangerousChars) {
          inSafeQuote = true;
          break;
        }
      }
    }

    if (!inSafeQuote) {
      return false;
    }

    idx = absStart + 1;
  }

  return true;
}
