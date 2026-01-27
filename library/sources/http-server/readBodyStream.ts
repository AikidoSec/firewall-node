import type { IncomingMessage, ServerResponse } from "http";
import { PassThrough } from "stream";
import { Agent } from "../../agent/Agent";
import { getMaxBodySize } from "../../helpers/getMaxBodySize";
import { replaceRequestBody } from "./replaceRequestBody";
import { type BusboyHeaders, Busboy } from "../../helpers/form-parsing";

import { getBodyDataType } from "../../agent/api-discovery/getBodyDataType";
import { tryParseJSON } from "../../helpers/tryParseJSON";
import { getInstance } from "../../agent/AgentSingleton";

type BodyReadResult =
  | {
      success: true;
      body: unknown;
    }
  | {
      success: false;
    };

export async function readBodyStream(
  req: IncomingMessage,
  res: ServerResponse,
  agent: Agent
): Promise<BodyReadResult> {
  let bodyText = "";
  let bodyFields: { name: string; value: unknown }[] = [];
  let bodySize = 0;
  const maxBodySize = getMaxBodySize();
  const stream = new PassThrough();

  let busboy: Busboy | undefined = undefined;

  if (req.headers["content-type"] !== undefined) {
    const bodyType = getBodyDataType(req.headers);
    if (bodyType === "form-data" || bodyType === "form-urlencoded") {
      busboy = new Busboy({
        headers: req.headers as BusboyHeaders,
      });

      busboy.on("error", (err) => {
        getInstance()?.log(
          `Error parsing form data body: ${err instanceof Error ? err.message : String(err)}`
        );
      });

      busboy.on("field", (fieldname, val) => {
        if (typeof val !== "string") {
          return;
        }

        if (val.includes('"')) {
          const decodedVal = tryParseJSON(val);
          if (decodedVal !== undefined) {
            bodyFields.push({ name: fieldname, value: decodedVal });
            return;
          }
        }

        bodyFields.push({ name: fieldname, value: val });
      });
    }
  }
  try {
    for await (const chunk of req) {
      if (bodySize + chunk.length > maxBodySize) {
        res.statusCode = 413;
        res.end(
          "This request was aborted by Aikido firewall because the body size exceeded the maximum allowed size. Use AIKIDO_MAX_BODY_SIZE_MB to increase the limit.",
          () => {
            req.destroy();
          }
        );
        agent.getInspectionStatistics().onAbortedRequest();

        return {
          success: false,
        };
      }

      bodySize += chunk.length;
      bodyText += chunk.toString();
      stream.push(chunk);

      busboy?.write(chunk);
    }
  } catch {
    res.statusCode = 500;
    res.end(
      "Aikido firewall encountered an error while reading the request body.",
      () => {
        req.destroy();
      }
    );
    busboy?.end();

    return {
      success: false,
    };
  }

  // End the stream
  stream.push(null);
  busboy?.end();

  // Ensure the body stream can be read again by the application
  replaceRequestBody(req, stream);

  if (bodyFields.length > 0) {
    return {
      success: true,
      body: {
        fields: bodyFields,
      },
    };
  }

  const parsedBodyText = tryParseJSON(bodyText);
  if (parsedBodyText) {
    return {
      success: true,
      body: parsedBodyText,
    };
  }

  return {
    success: true,
    body: undefined,
  };
}
