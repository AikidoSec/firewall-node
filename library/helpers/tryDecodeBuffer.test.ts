import * as t from "tap";
import { tryDecodeBuffer } from "./tryDecodeBuffer";

t.test("tryDecodeBuffer decodes valid UTF-8 buffer", async (t) => {
  const buffer = Buffer.from("Hello, world!", "utf-8");
  const result = tryDecodeBuffer(buffer);
  t.equal(result, "Hello, world!");
});

t.test(
  "tryDecodeBuffer returns undefined for invalid UTF-8 buffer",
  async (t) => {
    const buffer = Buffer.from([0xff, 0xfe, 0xfd]);
    const result = tryDecodeBuffer(buffer);
    t.equal(result, undefined);
  }
);

t.test("tryDecodeBuffer decodes valid UTF-8 ArrayBuffer", async (t) => {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode("Hello, ArrayBuffer!");
  const arrayBuffer = uint8Array.buffer;
  const result = tryDecodeBuffer(arrayBuffer);
  t.equal(result, "Hello, ArrayBuffer!");
});

t.test(
  "tryDecodeBuffer returns undefined for invalid UTF-8 ArrayBuffer",
  async (t) => {
    const invalidArray = new Uint8Array([0xff, 0xfe, 0xfd]);
    const result = tryDecodeBuffer(invalidArray.buffer);
    t.equal(result, undefined);
  }
);

t.test("tryDecodeBuffer with different encoding", async (t) => {
  const buffer = Buffer.from("48656c6c6f", "hex"); // "Hello" in hex
  const result = tryDecodeBuffer(buffer, "utf-8", false);
  t.equal(result, "Hello");
});

t.test("tryDecodeBuffer with utf8Only false", async (t) => {
  const buffer = Buffer.from([0xff, 0xfe, 0xfd]);
  const result = tryDecodeBuffer(buffer, "utf-8", false);
  t.equal(result, "���"); // Should decode to replacement characters
});
