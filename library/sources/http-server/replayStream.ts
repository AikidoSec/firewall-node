import type { IncomingMessage } from "http";

export function replayStream(req: IncomingMessage, chunks: Uint8Array[]) {
  for (const chunk of chunks) {
    req.emit("data", chunk);
  }

  req.emit("end");
  req.readable = true;
}
