// Based on https://github.com/rexxars/eventsource-parser
// MIT License - Copyright (c) 2025 Espen Hovlandsdal

import type { ParseError } from "./errors";

export interface EventSourceParser {
  feed(chunk: string): void;
  reset(options?: { consume?: boolean }): void;
}

export interface EventSourceMessage {
  event?: string | undefined;
  id?: string | undefined;
  data: string;
}

export interface ParserCallbacks {
  onEvent?: ((event: EventSourceMessage) => void) | undefined;
  onRetry?: ((retry: number) => void) | undefined;
  onComment?: ((comment: string) => void) | undefined;
  onError?: ((error: ParseError) => void) | undefined;
}
