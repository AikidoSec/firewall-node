import { getInstance } from "../../agent/AgentSingleton";
import { getPackageVersion } from "../../helpers/getPackageVersion";
import { satisfiesVersion } from "../../helpers/satisfiesVersion";

const INCOMPATIBLE_PACKAGES: Record<string, string> = {
  mongoose: "^1.0.0 || ^2.0.0 || ^3.0.0 || ^4.0.0",
};

export function preventPrototypePollution() {
  for (const pkg in INCOMPATIBLE_PACKAGES) {
    const version = getPackageVersion(pkg);

    if (!version) {
      continue;
    }

    const ranges = INCOMPATIBLE_PACKAGES[pkg];
    if (satisfiesVersion(version, ranges)) {
      getInstance()?.unableToPreventPrototypePollution(pkg, version);
      return;
    }
  }

  freezeBuiltins();

  getInstance()?.onPrototypePollutionPrevented();
}

function freezeBuiltins() {
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
}
