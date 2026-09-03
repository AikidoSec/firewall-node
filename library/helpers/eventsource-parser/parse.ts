// Based on https://github.com/rexxars/eventsource-parser
// MIT License - Copyright (c) 2025 Espen Hovlandsdal

import { ParseError } from "./errors";
import type { EventSourceParser, ParserCallbacks } from "./types";

function noop(_arg: unknown) {
  // intentional noop
}

export function createParser(callbacks: ParserCallbacks): EventSourceParser {
  const {
    onEvent = noop,
    onError = noop,
    onRetry = noop,
    onComment,
  } = callbacks;

  let incompleteLine = "";
  let isFirstChunk = true;
  let id: string | undefined;
  let data = "";
  let eventType = "";

  function feed(newChunk: string) {
    // Strip any UTF8 byte order mark (BOM) at the start of the stream
    const chunk = isFirstChunk
      ? newChunk.replace(/^\xEF\xBB\xBF/, "")
      : newChunk;

    const [complete, incomplete] = splitLines(`${incompleteLine}${chunk}`);

    for (const line of complete) {
      parseLine(line);
    }

    incompleteLine = incomplete;
    isFirstChunk = false;
  }

  function parseLine(line: string) {
    if (line === "") {
      dispatchEvent();
      return;
    }

    if (line.startsWith(":")) {
      if (onComment) {
        onComment(line.slice(line.startsWith(": ") ? 2 : 1));
      }
      return;
    }

    const fieldSeparatorIndex = line.indexOf(":");
    if (fieldSeparatorIndex !== -1) {
      const field = line.slice(0, fieldSeparatorIndex);
      const offset = line[fieldSeparatorIndex + 1] === " " ? 2 : 1;
      const value = line.slice(fieldSeparatorIndex + offset);
      processField(field, value, line);
      return;
    }

    processField(line, "", line);
  }

  function processField(field: string, value: string, line: string) {
    switch (field) {
      case "event":
        eventType = value;
        break;
      case "data":
        data = `${data}${value}\n`;
        break;
      case "id":
        id = value.includes("\0") ? undefined : value;
        break;
      case "retry":
        if (/^\d+$/.test(value)) {
          onRetry(parseInt(value, 10));
        } else {
          onError(
            new ParseError(`Invalid \`retry\` value: "${value}"`, {
              type: "invalid-retry",
              value,
              line,
            })
          );
        }
        break;
      default:
        onError(
          new ParseError(
            `Unknown field "${field.length > 20 ? `${field.slice(0, 20)}…` : field}"`,
            { type: "unknown-field", field, value, line }
          )
        );
        break;
    }
  }

  function dispatchEvent() {
    const shouldDispatch = data.length > 0;
    if (shouldDispatch) {
      onEvent({
        id,
        event: eventType || undefined,
        data: data.endsWith("\n") ? data.slice(0, -1) : data,
      });
    }

    id = undefined;
    data = "";
    eventType = "";
  }

  function reset(options: { consume?: boolean } = {}) {
    if (incompleteLine && options.consume) {
      parseLine(incompleteLine);
    }

    isFirstChunk = true;
    id = undefined;
    data = "";
    eventType = "";
    incompleteLine = "";
  }

  return { feed, reset };
}

function splitLines(
  chunk: string
): [complete: Array<string>, incomplete: string] {
  const lines: Array<string> = [];
  let incompleteLine = "";
  let searchIndex = 0;

  while (searchIndex < chunk.length) {
    const crIndex = chunk.indexOf("\r", searchIndex);
    const lfIndex = chunk.indexOf("\n", searchIndex);

    let lineEnd = -1;
    if (crIndex !== -1 && lfIndex !== -1) {
      lineEnd = Math.min(crIndex, lfIndex);
    } else if (crIndex !== -1) {
      if (crIndex === chunk.length - 1) {
        lineEnd = -1;
      } else {
        lineEnd = crIndex;
      }
    } else if (lfIndex !== -1) {
      lineEnd = lfIndex;
    }

    if (lineEnd === -1) {
      incompleteLine = chunk.slice(searchIndex);
      break;
    } else {
      const line = chunk.slice(searchIndex, lineEnd);
      lines.push(line);

      searchIndex = lineEnd + 1;
      if (chunk[searchIndex - 1] === "\r" && chunk[searchIndex] === "\n") {
        searchIndex++;
      }
    }
  }

  return [lines, incompleteLine];
}
