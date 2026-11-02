import type { Transform } from "stream";
import * as zlib from "zlib";
import {
  type AICall,
  isAIRequestPath,
  parseAIResponse,
} from "./parseAIResponse";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export type AIResponseParser = {
  write(chunk: Buffer): void;
  end(): void;
  destroy(): void;
};

export function createAIResponseParser({
  url,
  contentType,
  contentEncoding,
  onCall,
}: {
  url: URL;
  contentType: string | undefined;
  contentEncoding: string | undefined;
  onCall: (call: AICall) => void;
}): AIResponseParser | undefined {
  if (!isAIRequestPath(url.pathname)) {
    return undefined;
  }
  const mime = contentType?.split(";", 1)[0].trim().toLowerCase();
  if (mime !== "application/json" && !mime?.endsWith("+json")) {
    return undefined;
  }
  const decoder = createDecoder(contentEncoding);
  if (decoder === null) {
    return undefined;
  }
  return new ResponseParser(url, decoder, onCall);
}

class ResponseParser implements AIResponseParser {
  private finished = false;
  private ending = false;
  private encodedBytes = 0;
  private decodedBytes = 0;
  private readonly chunks: Buffer[] = [];

  constructor(
    private readonly url: URL,
    private readonly decoder: Transform | undefined,
    private readonly onCall: (call: AICall) => void
  ) {
    if (decoder) {
      decoder.on("data", (chunk: Buffer) => this.onDecoded(chunk));
      decoder.on("end", () => this.finish());
      decoder.on("error", () => this.destroy());
    }
  }

  write(chunk: Buffer) {
    if (this.finished || this.ending) {
      return;
    }
    try {
      this.encodedBytes += chunk.length;
      if (this.encodedBytes > MAX_BODY_BYTES) {
        this.destroy();
      } else if (this.decoder) {
        this.decoder.write(Buffer.from(chunk));
      } else {
        this.onDecoded(Buffer.from(chunk));
      }
    } catch {
      this.destroy();
    }
  }

  end() {
    if (this.finished || this.ending) {
      return;
    }
    this.ending = true;
    try {
      if (this.decoder) {
        this.decoder.end();
      } else {
        this.finish();
      }
    } catch {
      this.destroy();
    }
  }

  destroy() {
    this.finished = true;
    this.chunks.length = 0;
    this.decoder?.destroy();
  }

  private onDecoded(chunk: Buffer) {
    if (this.finished) {
      return;
    }
    this.decodedBytes += chunk.length;
    if (this.decodedBytes > MAX_BODY_BYTES) {
      this.destroy();
      return;
    }
    this.chunks.push(chunk);
  }

  private finish() {
    if (this.finished) {
      return;
    }
    this.finished = true;
    try {
      const body: unknown = JSON.parse(
        Buffer.concat(this.chunks).toString("utf8")
      );
      const call = parseAIResponse(this.url, body);
      if (call) {
        this.onCall(call);
      }
    } catch {
      this.destroy();
    } finally {
      this.chunks.length = 0;
    }
  }
}

function createDecoder(
  encoding: string | undefined
): Transform | undefined | null {
  switch ((encoding ?? "").trim().toLowerCase()) {
    case "":
    case "identity":
      return undefined;
    case "gzip":
      return zlib.createGunzip();
    case "deflate":
      return zlib.createInflate();
    case "br":
      return zlib.createBrotliDecompress();
    default:
      return null;
  }
}
