import { Token } from "../api/Token";
import { ConfigAPI, ConfigAPIResponse } from "./ConfigAPI";

export class ConfigAPIThatThrows implements ConfigAPI {
  getLastUpdatedAt(token: Token): Promise<number> {
    throw new Error("Something went wrong");
  }

  getConfig(token: Token): Promise<ConfigAPIResponse> {
    throw new Error("Something went wrong");
  }
}
