import {
  cloudFunctionWithNewInstrumentation,
  setToken,
} from "../agent/protect";
import { startWithNewInstrumentation } from "../instrument/start";

startWithNewInstrumentation(cloudFunctionWithNewInstrumentation);

export { setToken };
