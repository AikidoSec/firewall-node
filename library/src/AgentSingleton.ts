import { Agent } from "./Agent";

let instance: Agent | undefined = undefined;

export function getInstance() {
  return instance;
}

export function setInstance(agent: Agent) {
  instance = agent;
}
