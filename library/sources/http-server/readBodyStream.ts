import type { IncomingMessage } from "node:http";
import { ServerResponse } from "node:http";
import { PassThrough } from "node:stream";
import { Agent } from "../../agent/Agent";
import { getMaxBodySize } from "../../helpers/getMaxBodySize";
import { replaceRequestBody } from "./replaceRequestBody";

type BodyReadResult =
  | {
      success: true;
      body: string;
    }
  | {
      success: false;
    };

export async function readBodyStream(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  agent: Agent
): Promise<BodyReadResult> {
  let body = "";
  let bodySize = 0;
  const maxBodySize = getMaxBodySize();
  const stream = new PassThrough();

  try {
    for await (const chunk of req) {
      if (bodySize + chunk.length > maxBodySize) {
        res.statusCode = 413;
        res.end(
          "This request was aborted by Aikido firewall because the body size exceeded the maximum allowed size. Use AIKIDO_MAX_BODY_SIZE_MB to increase the limit."
        );
        agent.getInspectionStatistics().onAbortedRequest();

        return {
          success: false,
        };
      }

      bodySize += chunk.length;
      body += chunk.toString();
      stream.push(chunk);
    }
  } catch {
    res.statusCode = 500;
    res.end(
      "Aikido firewall encountered an error while reading the request body."
    );

    return {
      success: false,
    };
  }

  // End the stream
  stream.push(null);

  // Ensure the body stream can be read again by the application
  replaceRequestBody(req, stream);

  return {
    success: true,
    body,
  };
}
