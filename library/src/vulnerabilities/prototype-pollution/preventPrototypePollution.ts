import { getInstance } from "../../agent/AgentSingleton";

export function preventPrototypePollution() {
  // Taken from https://github.com/snyk-labs/nopp/blob/main/index.js
  [
    Object,
    Object.prototype,
    Function,
    Function.prototype,
    Array,
    Array.prototype,
    String,
    String.prototype,
    Number,
    Number.prototype,
    Boolean,
    Boolean.prototype,
  ].forEach(Object.freeze);

  getInstance()?.onPrototypePollutionPrevented();
}
