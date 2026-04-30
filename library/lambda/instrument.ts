import { lambdaWithNewInstrumentation, setToken } from "../agent/protect";
import { startWithNewInstrumentation } from "../instrument/start";

startWithNewInstrumentation(lambdaWithNewInstrumentation);

export { setToken };
