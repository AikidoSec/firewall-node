import { StringDecoder } from "string_decoder";
import type { Transform } from "stream";
import { createBrotliDecompress, createGunzip, createInflate } from "zlib";
import type { AIWireFormat } from "./matchAIRequest";
import {
  type AICall,
  AIEventStreamParser,
  parseAIResponseBody,
} from "./parseAIResponse";

export const maxAIResponseSize = 8 * 1024 * 1024;
const maxSSEEventSize = 1024 * 1024;

export type AIResponseReader = {
  write(chunk: Uint8Array): boolean;
  end(): void;
  destroy(): void;
};

export function createAIResponseReader(
  format: AIWireFormat,
  contentType: string | undefined,
  contentEncoding: string | undefined,
  onEnd: (call: AICall | undefined) => void
): AIResponseReader | undefined {
  const mime = contentType?.split(";", 1)[0].trim().toLowerCase();
  if (mime !== "application/json" && mime !== "text/event-stream")
    return undefined;

  let decoder: Transform | undefined;
  switch (contentEncoding?.trim().toLowerCase()) {
    case undefined:
    case "":
    case "identity":
      break;
    case "gzip":
    case "x-gzip":
      decoder = createGunzip();
      break;
    case "deflate":
      decoder = createInflate();
      break;
    case "br":
      decoder = createBrotliDecompress();
      break;
    default:
      return undefined;
  }

  const parser = new AIEventStreamParser(format);
  const utf8 = new StringDecoder("utf8");
  const chunks: Buffer[] = [];
  let size = 0;
  let pending = "";
  let scanFrom = 0;
  let data: string[] = [];
  let eventSize = 0;
  let failed = false;
  let ended = false;
  let reported = false;

  const report = (call: AICall | undefined) => {
    if (reported) return;
    reported = true;
    try {
      onEnd(call);
    } catch {
      return;
    }
  };
  const destroy = () => {
    failed = true;
    pending = "";
    data = [];
    chunks.length = 0;
    decoder?.destroy();
  };
  const dispatch = () => {
    if (data.length) {
      try {
        parser.onEvent(JSON.parse(data.join("\n")));
      } catch {
        data = [];
      }
    }
    data = [];
    eventSize = 0;
  };
  const line = (text: string) => {
    if (!text) {
      dispatch();
    } else if (text.startsWith("data:")) {
      const value = text.slice(5).replace(/^ /, "");
      eventSize += value.length;
      if (eventSize > maxSSEEventSize) destroy();
      else data.push(value);
    }
  };
  const writeDecoded = (chunk: Uint8Array) => {
    if (failed) return;
    if (mime === "application/json") {
      size += chunk.byteLength;
      if (size > maxAIResponseSize) destroy();
      else chunks.push(Buffer.from(chunk));
      return;
    }
    pending += utf8.write(Buffer.from(chunk));
    let start = 0;
    for (let index = scanFrom; index < pending.length; index++) {
      const char = pending[index];
      if (char !== "\n" && char !== "\r") continue;
      if (char === "\r" && index === pending.length - 1) break;
      if (index - start > maxSSEEventSize) {
        destroy();
        return;
      }
      line(pending.slice(start, index));
      if (failed) return;
      if (char === "\r" && pending[index + 1] === "\n") index++;
      start = index + 1;
    }
    scanFrom = pending.length - start;
    pending = pending.slice(start);
    if (pending.endsWith("\r")) scanFrom--;
    if (pending.length > maxSSEEventSize) destroy();
  };
  const finish = () => {
    let call: AICall | undefined;
    if (!failed) {
      if (mime === "text/event-stream") {
        pending += utf8.end();
        if (pending) line(pending.replace(/\r$/, ""));
        dispatch();
        call = parser.getCall();
      } else {
        try {
          call = parseAIResponseBody(
            format,
            JSON.parse(Buffer.concat(chunks).toString("utf8"))
          );
        } catch {
          call = undefined;
        }
      }
    }
    chunks.length = 0;
    report(call);
  };
  decoder?.on("data", (chunk: Buffer) => {
    try {
      writeDecoded(chunk);
    } catch {
      destroy();
    }
  });
  decoder?.on("error", () => {
    destroy();
    report(undefined);
  });
  decoder?.on("end", () => {
    try {
      finish();
    } catch {
      destroy();
      report(undefined);
    }
  });
  decoder?.on("close", () => {
    if (failed) report(undefined);
  });

  return {
    write(chunk) {
      if (failed || ended) return false;
      try {
        if (decoder) {
          // Copy before asynchronous decompression because the application owns the buffer.
          if (decoder.writableLength + chunk.byteLength > maxAIResponseSize)
            destroy();
          else decoder.write(Buffer.from(chunk));
        } else writeDecoded(chunk);
      } catch {
        destroy();
      }
      return !failed;
    },
    end() {
      if (ended) return;
      ended = true;
      if (failed) report(undefined);
      else if (decoder) decoder.end();
      else finish();
    },
    destroy,
  };
}
