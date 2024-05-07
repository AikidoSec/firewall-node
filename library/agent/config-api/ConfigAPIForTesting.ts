import { Token } from "../Token";
import { ConfigAPI } from "./ConfigAPI";

export class ConfigAPIForTesting implements ConfigAPI {
  constructor(private lastUpdatedAt = 0) {}

  setLastUpdatedAt(lastUpdatedAt: number) {
    this.lastUpdatedAt = lastUpdatedAt;
  }

  async getLastUpdatedAt(token: Token): Promise<number> {
    return this.lastUpdatedAt;
  }
}
