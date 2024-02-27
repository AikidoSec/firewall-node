import { Hooks } from "./hooks/Hooks";

export interface Wrapper {
  wrap(hooks: Hooks): void;
}
