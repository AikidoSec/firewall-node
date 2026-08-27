// Based on https://github.com/rexxars/eventsource-parser
// MIT License - Copyright (c) 2025 Espen Hovlandsdal

export type ErrorType = "invalid-retry" | "unknown-field";

export class ParseError extends Error {
  type: ErrorType;
  field?: string | undefined;
  value?: string | undefined;
  line?: string | undefined;

  constructor(
    message: string,
    options: { type: ErrorType; field?: string; value?: string; line?: string }
  ) {
    super(message);
    this.name = "ParseError";
    this.type = options.type;
    this.field = options.field;
    this.value = options.value;
    this.line = options.line;
  }
}
