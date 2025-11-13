// Set to true if the new hook system was imported (also if no agent)
// Prevents that the following import has side effects if it's still inside the codebase / used for middleware
// import Zen from "@aikidosec/firewall"

let _isNewHookSystemUsed = false;

export function setIsNewHookSystemUsed(value: boolean) {
  _isNewHookSystemUsed = value;
}

export function isNewHookSystemUsed() {
  return _isNewHookSystemUsed;
}
