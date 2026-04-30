import { protectWithNewInstrumentation, setToken } from "../agent/protect";
import { startWithNewInstrumentation } from "./start";

startWithNewInstrumentation(protectWithNewInstrumentation);

export { setToken };
