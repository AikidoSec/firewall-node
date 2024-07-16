import type { WebSocket } from "ws";
import { Agent } from "../../agent/Agent";
import { getMaxBodySize } from "../../helpers/getMaxBodySize";

export type WsData = ArrayBuffer | Blob | Buffer | Buffer[] | string;

/**
 * If the ws event arg is an event object, extract the data from it
 */
function extractWsDataFromEvent(arg: unknown): WsData {
  if (
    typeof arg === "object" &&
    arg !== null &&
    "data" in arg &&
    "type" in arg &&
    "target" in arg
  ) {
    return arg.data as WsData;
  }
  return arg as WsData;
}

/**
 * Tried to parse the data as JSON, if it fails it returns the original data
 */
function tryJSONParse(data: string) {
  try {
    return JSON.parse(data);
  } catch (e) {
    return data;
  }
}

function isBufferArray(data: WsData): boolean {
  return Array.isArray(data) && data.every((d) => Buffer.isBuffer(d));
}

function checkWsDataSize(data: WsData) {
  const maxMsgSize = getMaxBodySize();
  let size = -1;

  if (global.Blob && data instanceof Blob) {
    size = data.size;
  } else if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
    size = data.byteLength;
  } else if (typeof data === "string") {
    size = Buffer.byteLength(data, "utf8");
  } else if (isBufferArray(data)) {
    // @ts-expect-error Typescript does not detect that data can not be an blob because of the global.Blob check required for Node.js 16
    size = Buffer.concat(data).byteLength;
  }

  return size > maxMsgSize;
}

export async function parseWsData(
  args: any[],
  agent?: Agent
): Promise<{ data: string | object | undefined; tooLarge: boolean }> {
  if (!args.length) {
    return { data: undefined, tooLarge: false };
  }
  const data = extractWsDataFromEvent(args[0]);
  let messageStr: string | undefined;

  try {
    const tooLarge = checkWsDataSize(data);
    if (tooLarge) {
      return { data: undefined, tooLarge: true };
    }

    // Handle Blob
    if (global.Blob && data instanceof Blob) {
      messageStr = await data.text();
      if (typeof messageStr !== "string" || messageStr.includes("\uFFFD")) {
        return { data: undefined, tooLarge: false };
      }
    } // Decode ArrayBuffer or Buffer to string if it is valid utf-8 (or ascii)
    else if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
      const decoder = new TextDecoder("utf-8", {
        fatal: true, // Throw error if buffer is not valid utf-8
      });

      messageStr = decoder.decode(data);
    } //Check if is string
    else if (typeof data === "string") {
      messageStr = data;
    } // Check if is array of Buffers, concat and decode
    else if (isBufferArray(data)) {
      // @ts-expect-error Typescript does not detect that data can not be an blob because of the global.Blob check required for Node.js 16
      const concatenatedBuffer = Buffer.concat(data);
      const decoder = new TextDecoder("utf-8", {
        fatal: true,
      });

      messageStr = decoder.decode(concatenatedBuffer);
    } else {
      // Data type not supported
      throw new Error("Unsupported ws message data type");
    }
  } catch (e) {
    if (agent) {
      if (e instanceof Error) {
        agent.log(`Failed to parse WebSocket message: ${e.message}`);
      } else {
        agent.log(`Failed to parse WebSocket message`);
      }
    }
    return { data: undefined, tooLarge: false };
  }

  if (typeof messageStr !== "string") {
    return { data: undefined, tooLarge: false };
  }

  return { data: tryJSONParse(messageStr), tooLarge: false };
}
