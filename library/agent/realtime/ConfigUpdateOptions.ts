import type { Token } from "../api/Token";
import type { Config } from "../Config";
import type { Logger } from "../logger/Logger";

export type ConfigUpdateOptions = {
  onConfigUpdate: (config: Config) => void;
  token: Token | undefined;
  logger: Logger;
  lastUpdatedAt: number;
};
