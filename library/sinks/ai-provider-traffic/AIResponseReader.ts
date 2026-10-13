import { PassThrough, type Transform } from "stream";
import { finished } from "stream/promises";
import { createBrotliDecompress, createGunzip, createInflate } from "zlib";
import type { AIWireFormat } from "./matchAIRequest";
import {
  type AICall,
  AIEventStreamParser,
  parseAIResponseBody,
} from "./parseAIResponse";

export const maxAIResponseSize = 8 * 1024 * 1024;

export type AIResponseReader = {
  // Returns false when the response can't be parsed anymore
  write(chunk: Uint8Array): boolean;
  end(): Promise<AICall | undefined>;
  destroy(): void;
};

type DecodedBody = {
  // Returns false when the body is too large
  write(chunk: Buffer): boolean;
  end(): AICall | undefined;
};

export function createAIResponseReader(
  format: AIWireFormat,
  contentType: string | undefined,
  contentEncoding: string | undefined
): AIResponseReader | undefined {
  const decoder = createDecoder(contentEncoding);
  if (!decoder) {
    return undefined;
  }

  const body = contentType?.includes("text/event-stream")
    ? createEventStreamBody(format)
    : createJSONBody(format);

  let failed = false;
  const fail = () => {
    failed = true;
    decoder.destroy();
  };

  decoder.on("data", (chunk: Buffer) => {
    try {
      if (!failed && !body.write(chunk)) {
        fail();
      }
    } catch {
      fail();
    }
  });
  decoder.on("error", fail);

  return {
    write(chunk) {
      if (!failed) {
        // Copy, the app owns the original buffer
        decoder.write(Buffer.from(chunk));
      }
      return !failed;
    },
    async end() {
      if (failed) {
        return undefined;
      }
      decoder.end();
      try {
        await finished(decoder);
      } catch {
        return undefined;
      }
      return failed ? undefined : body.end();
    },
    destroy: fail,
  };
}

function createDecoder(
  contentEncoding: string | undefined
): Transform | undefined {
  switch (contentEncoding) {
    case undefined:
    case "":
    case "identity":
      return new PassThrough();
    case "gzip":
    case "x-gzip":
      return createGunzip();
    case "deflate":
      return createInflate();
    case "br":
      return createBrotliDecompress();
    default:
      return undefined;
  }
}

function createJSONBody(format: AIWireFormat): DecodedBody {
  const chunks: Buffer[] = [];
  let size = 0;

  return {
    write(chunk) {
      size += chunk.length;
      chunks.push(chunk);
      return size <= maxAIResponseSize;
    },
    end() {
      let json: unknown;
      try {
        json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return undefined;
      }
      return parseAIResponseBody(format, json);
    },
  };
}

// Parses each line as it arrives, long streams are larger than maxAIResponseSize
function createEventStreamBody(format: AIWireFormat): DecodedBody {
  const parser = new AIEventStreamParser(format);
  let line: Buffer[] = [];
  let lineSize = 0;

  const onLine = (bytes: Buffer) => {
    const text = bytes.toString("utf8");
    if (!text.startsWith("data:")) {
      return;
    }

    const data = text.slice("data:".length).trim();
    if (data === "[DONE]") {
      return;
    }

    try {
      parser.onEvent(JSON.parse(data));
    } catch {
      // Not JSON, skip the line
    }
  };

  return {
    write(chunk) {
      let start = 0;
      let newline = chunk.indexOf("\n");
      while (newline !== -1) {
        line.push(chunk.subarray(start, newline));
        onLine(Buffer.concat(line));
        line = [];
        lineSize = 0;
        start = newline + 1;
        newline = chunk.indexOf("\n", start);
      }

      line.push(chunk.subarray(start));
      lineSize += chunk.length - start;
      return lineSize <= maxAIResponseSize;
    },
    end() {
      onLine(Buffer.concat(line));
      return parser.getCall();
    },
  };
}
