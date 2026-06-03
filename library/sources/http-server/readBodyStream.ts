import type { IncomingMessage, ServerResponse } from "http";
import { PassThrough } from "stream";
import { Agent } from "../../agent/Agent";
import { getMaxBodySize } from "../../helpers/getMaxBodySize";
import { replaceRequestBody } from "./replaceRequestBody";
import { type BusboyHeaders, Busboy } from "../../helpers/form-parsing";

import { getBodyDataType } from "../../agent/api-discovery/getBodyDataType";
import { tryParseJSON } from "../../helpers/tryParseJSON";
import { getInstance } from "../../agent/AgentSingleton";

type BodyFile = {
  fieldname: string;
  filename: string;
  encoding: string;
  mimeType: string;
};

type BodyReadResult =
  | {
      success: true;
      body: unknown;
      files?: BodyFile[];
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
  const bodyFiles: BodyFile[] = [];
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

      busboy.on(
        "file",
        (fieldname, fileStream, filename, encoding, mimeType) => {
          bodyFiles.push({
            fieldname: typeof fieldname === "string" ? fieldname : "",
            filename: typeof filename === "string" ? filename : "",
            encoding: typeof encoding === "string" ? encoding : "",
            mimeType: typeof mimeType === "string" ? mimeType : "",
          });
          // Drain the file stream so busboy doesn't stall waiting for a
          // consumer. We deliberately do not buffer the contents — only the
          // metadata is needed for injection detection on filename/mimetype.
          fileStream.resume();
        }
      );
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

  if (bodyFields.length > 0 || bodyFiles.length > 0) {
    return {
      success: true,
      body: bodyFields.length > 0 ? { fields: bodyFields } : undefined,
      files: bodyFiles.length > 0 ? bodyFiles : undefined,
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
