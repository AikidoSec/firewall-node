import { Token } from "../api/Token";
import { ConfigAPI } from "./ConfigAPI";

export class ConfigAPIThatThrows implements ConfigAPI {
  getLastUpdatedAt(token: Token): Promise<number> {
    throw new Error("Something went wrong");
  }
}
