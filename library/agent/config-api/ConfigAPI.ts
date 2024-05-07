import { Token } from "../Token";

export interface ConfigAPI {
  getLastUpdatedAt(token: Token): Promise<number>;
}
