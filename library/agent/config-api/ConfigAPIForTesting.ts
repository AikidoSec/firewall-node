import { Token } from "../Token";
import { ConfigAPI } from "./ConfigAPI";

export class ConfigAPIForTesting implements ConfigAPI {
  constructor(private lastUpdatedAt = 0) {}

  async getLastUpdatedAt(token: Token): Promise<number> {
    return this.lastUpdatedAt;
  }
}
