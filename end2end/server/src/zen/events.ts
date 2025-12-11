import type { App } from "./apps.ts";

const events = new Map();

export function captureEvent(event: unknown, app: App) {
  if (!events.has(app.id)) {
    events.set(app.id, []);
  }

  events.get(app.id).push(event);
}

export function listEvents(app: App) {
  return events.get(app.id) || [];
}
