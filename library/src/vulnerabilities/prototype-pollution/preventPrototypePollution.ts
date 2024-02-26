import { getInstance } from "../../agent/AgentSingleton";

export function preventPrototypePollution() {
  // Taken from https://github.com/snyk-labs/nopp/blob/main/index.js
  [
    Object,
    Object.prototype,
    Function,
    // We don't freeze the prototype of Function, as it's used by mysql2
    // We'll investigate later and see how this can be abused
    // Function.prototype,
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
