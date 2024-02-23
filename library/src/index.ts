import { runWithContext } from "./agent/Context";
import { protect, lambda } from "./agent/protect";
import { preventPrototypePollution } from "./vulnerabilities/prototype-pollution/preventPrototypePollution";
import {nextMiddleware} from "./sources/Next";

export { protect, lambda, preventPrototypePollution, runWithContext, nextMiddleware };
