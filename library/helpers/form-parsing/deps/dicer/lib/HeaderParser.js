"use strict";

const EventEmitter = require("node:events").EventEmitter;
const inherits = require("node:util").inherits;
const getLimit = require("../../../lib/utils/getLimit");

const B_DCRLF = Buffer.from("\r\n\r\n");
const S_DCRLF = "\r\n\r\n";

function HeaderParser(cfg) {
  EventEmitter.call(this);

  cfg = cfg || {};
  this.nread = 0;
  this.maxed = false;
  this.npairs = 0;
  this.maxHeaderPairs = getLimit(cfg, "maxHeaderPairs", 2000);
  this.maxHeaderSize = getLimit(cfg, "maxHeaderSize", 80 * 1024);
  this.buffer = "";
  this.header = Object.create(null);
  this.finished = false;
  this.tail = "";
}
inherits(HeaderParser, EventEmitter);

HeaderParser.prototype.push = function (data) {
  if (!Buffer.isBuffer(data)) {
    data = Buffer.from(data, "binary");
  }

  let end = data.length;
  let appendEnd = data.length;
  let found = false;
  const tail = this.tail;

  for (let i = tail.length; i > 0; --i) {
    if (tail.endsWith(S_DCRLF.slice(0, i))) {
      let matched = data.length >= S_DCRLF.length - i;
      for (let j = i; matched && j < S_DCRLF.length; ++j) {
        matched = data[j - i] === S_DCRLF.charCodeAt(j);
      }
      if (matched) {
        end = S_DCRLF.length - i;
        appendEnd = 0;
        found = true;
        break;
      }
    }
  }

  if (!found) {
    const pos = data.indexOf(B_DCRLF);
    if (pos !== -1) {
      end = pos + B_DCRLF.length;
      appendEnd = pos;
      found = true;
    }
  }

  if (!found) {
    this.tail =
      data.length >= 3
        ? data.toString("binary", data.length - 3)
        : (tail + data.toString("binary")).slice(-3);
  } else {
    this.tail = "";
  }

  if (appendEnd !== 0 && !this.maxed) {
    const remaining = this.maxHeaderSize - this.nread;
    if (appendEnd >= remaining) {
      this.buffer += data.toString("binary", 0, remaining);
      this.nread = this.maxHeaderSize;
      this.maxed = true;
    } else {
      this.buffer += data.toString("binary", 0, appendEnd);
      this.nread += appendEnd;
    }
  }

  if (found) {
    this._finish();
    return end;
  }
};

HeaderParser.prototype.reset = function () {
  this.finished = false;
  this.buffer = "";
  this.header = Object.create(null);
  this.tail = "";
};

HeaderParser.prototype._finish = function () {
  if (this.buffer) {
    this._parseHeader();
  }
  const header = this.header;
  this.header = Object.create(null);
  this.buffer = "";
  this.tail = "";
  this.finished = true;
  this.nread = this.npairs = 0;
  this.maxed = false;
  this.emit("header", header);
};

HeaderParser.prototype._parseHeader = function () {
  if (this.npairs === this.maxHeaderPairs) {
    return;
  }

  const buffer = this.buffer;
  let h;
  let lineStart = 0;

  while (lineStart < buffer.length) {
    let lineEnd = buffer.indexOf("\r\n", lineStart);
    if (lineEnd === -1) {
      lineEnd = buffer.length;
    }

    if (lineEnd === lineStart) {
      lineStart = lineEnd + 2;
      continue;
    }

    // Reject bare line breaks instead of exposing them in parsed values
    const line = buffer.slice(lineStart, lineEnd);
    if (line.includes("\r") || line.includes("\n")) {
      return;
    }

    if ((buffer[lineStart] === "\t" || buffer[lineStart] === " ") && h) {
      // folded header content
      // RFC2822 says to just remove the CRLF and not the whitespace following
      // it, so we follow the RFC and include the leading whitespace ...
      this.header[h][this.header[h].length - 1] += buffer.slice(
        lineStart,
        lineEnd
      );
      lineStart = lineEnd + 2;
      continue;
    }

    const posColon = buffer.indexOf(":", lineStart);
    if (posColon === -1 || posColon === lineStart || posColon > lineEnd) {
      return;
    }
    h = buffer.slice(lineStart, posColon).toLowerCase();
    let valueStart = posColon + 1;
    if (buffer[valueStart] === " " || buffer[valueStart] === "\t") {
      ++valueStart;
    }
    const values = this.header[h] || (this.header[h] = []);
    values.push(buffer.slice(valueStart, lineEnd));
    if (++this.npairs === this.maxHeaderPairs) {
      break;
    }

    lineStart = lineEnd + 2;
  }
};

module.exports = HeaderParser;
