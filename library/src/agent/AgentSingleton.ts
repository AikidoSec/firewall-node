import { Agent } from "./Agent";

let instance: Agent | undefined = undefined;

/**
 * This module is a storage unit, this function retrieves the stored value
 * @returns The current instance stored in the instance variable
 */
export function getInstance() {
  return instance;
}

/**
 * This module is a storage unit, this function sets the stored value
 * @param agent The agent you want stored as the current instance.
 */
export function setInstance(agent: Agent) {
  instance = agent;
}
