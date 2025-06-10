const events = new Map();

function captureEvent(event, app) {
  if (!events.has(app.id)) {
    events.set(app.id, []);
  }

  events.get(app.id).push(event);
}

function listEvents(app) {
  return events.get(app.id) || [];
}

module.exports = {
  captureEvent,
  listEvents,
};
