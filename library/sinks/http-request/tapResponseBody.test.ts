import * as t from "tap";
import { once } from "events";
import { IncomingMessage } from "http";
import { Socket } from "net";
import { Writable } from "stream";
import { pipeline } from "stream/promises";
import { createAIResponseParser } from "../../ai-governance/AIResponseParser";
import type { AICall } from "../../ai-governance/parseAIResponse";
import { tapResponseBody } from "./tapResponseBody";

const body = Buffer.from(
  JSON.stringify({
    model: "model-x",
    choices: [{ message: { content: "Hi 👋" } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  })
);
const expected = [{ model: "model-x", inputTokens: 10, outputTokens: 5 }];

function observe(response: IncomingMessage): AICall[] {
  const calls: AICall[] = [];
  const parser = createAIResponseParser({
    url: new URL("http://localhost/v1/chat/completions"),
    contentType: "application/json",
    contentEncoding: undefined,
    onCall: (call) => calls.push(call),
  })!;
  tapResponseBody(response, parser);
  return calls;
}

t.test(
  "it leaves an unread response buffered until the app consumes it",
  async (t) => {
    const response = new IncomingMessage(new Socket());
    const calls = observe(response);
    response.complete = true;
    response.push(body);
    response.push(null);

    t.equal(response.readableFlowing, null);
    t.equal(response.readableLength, body.length);
    t.same(calls, []);

    const chunks: Buffer[] = [];
    for await (const chunk of response) {
      chunks.push(chunk);
    }
    t.same(Buffer.concat(chunks), body);
    t.same(calls, expected);
  }
);

t.test(
  "it records consumed chunks once across data and readable modes",
  async (t) => {
    for (const mode of ["data", "utf8", "pipe", "readable"]) {
      const response = new IncomingMessage(new Socket());
      const calls = observe(response);
      const chunks: Buffer[] = [];
      const collect = (chunk: Buffer | string) =>
        chunks.push(Buffer.from(chunk));
      const consume = () => {
        let chunk: Buffer | null;
        while ((chunk = response.read(11)) !== null) {
          collect(chunk);
        }
      };
      let ended: Promise<unknown>;
      if (mode === "pipe") {
        ended = pipeline(
          response,
          new Writable({
            highWaterMark: 1,
            write(chunk: Buffer, _encoding, callback) {
              collect(chunk);
              setImmediate(callback);
            },
          })
        );
      } else {
        ended = once(response, "end");
      }

      if (mode === "utf8") {
        response.setEncoding("utf8");
      }
      if (mode === "data" || mode === "utf8") {
        response.on("data", collect);
      }
      if (mode === "readable") {
        response.on("readable", consume);
      }

      setImmediate(() => {
        const split = body.indexOf(Buffer.from("👋")) + 2;
        response.push(body.subarray(0, split));
        response.push(body.subarray(split));
        response.complete = true;
        response.push(null);
      });
      await ended;
      t.same(Buffer.concat(chunks), body, mode);
      t.same(calls, expected, mode);
    }
  }
);

t.test(
  "it discards aborted bodies without removing other read wrappers",
  async (t) => {
    for (const complete of [false, true]) {
      for (const wrapping of ["none", "before", "after"]) {
        const response = new IncomingMessage(new Socket());
        const descriptor = Object.getOwnPropertyDescriptor(response, "read");
        const initialRead = response.read;
        const earlierRead: IncomingMessage["read"] = function (
          this: IncomingMessage,
          ...args
        ) {
          return Reflect.apply(initialRead, this, args);
        };
        if (wrapping === "before") {
          response.read = earlierRead;
        }
        const calls = observe(response);
        response.on("readable", () => {
          response.read();
        });
        const observedRead = response.read;
        const laterRead: IncomingMessage["read"] = function (
          this: IncomingMessage,
          ...args
        ) {
          return Reflect.apply(observedRead, this, args);
        };
        if (wrapping === "after") {
          response.read = laterRead;
        }

        const closed = once(response, "close");
        if (complete) {
          response.complete = true;
          response.push(body);
          response.push(null);
        } else {
          response.push(body.subarray(0, 10));
          response.destroy();
        }
        await closed;
        let expectedRead = initialRead;
        if (wrapping === "after") {
          expectedRead = laterRead;
        } else if (wrapping === "before") {
          expectedRead = earlierRead;
        }
        t.equal(response.read, expectedRead);
        if (wrapping === "none") {
          t.same(Object.getOwnPropertyDescriptor(response, "read"), descriptor);
        }
        if (complete) {
          t.same(calls, expected);
        } else {
          t.same(calls, []);
        }
      }
    }
  }
);
