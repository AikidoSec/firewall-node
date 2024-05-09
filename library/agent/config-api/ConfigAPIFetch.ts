import { fetch } from "../../helpers/fetch";
import { Token } from "../api/Token";
import { ConfigAPI, ConfigAPIResponse } from "./ConfigAPI";

export class ConfigAPIFetch implements ConfigAPI {
  constructor(
    private readonly configAPIURL: URL,
    private readonly reportingAPIURL: URL
  ) {}

  async getLastUpdatedAt(token: Token): Promise<number> {
    const { body, statusCode } = await fetch({
      url: new URL(`${this.configAPIURL.toString()}config`),
      method: "GET",
      headers: {
        Authorization: token.asString(),
      },
      body: "",
      timeoutInMS: 3000,
    });

    if (statusCode !== 200) {
      throw new Error(`Invalid response (${statusCode}): ${body}`);
    }

    return JSON.parse(body).configUpdatedAt;
  }

  async getConfig(token: Token): Promise<ConfigAPIResponse> {
    const { body, statusCode } = await fetch({
      url: new URL(`${this.reportingAPIURL.toString()}api/runtime/config`),
      method: "GET",
      headers: {
        Authorization: token.asString(),
      },
      body: "",
      timeoutInMS: 3000,
    });

    if (statusCode !== 200) {
      throw new Error(`Invalid response (${statusCode}): ${body}`);
    }

    return JSON.parse(body);
  }
}
