import { Token } from "../api/Token";

export interface ConfigAPI {
  getLastUpdatedAt(token: Token): Promise<number>;
}
