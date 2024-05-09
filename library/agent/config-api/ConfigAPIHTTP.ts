import { HttpClient } from "../http/HttpClient";
import { Token } from "../api/Token";
import { ConfigAPI } from "./ConfigAPI";

export class ConfigAPIHTTP implements ConfigAPI {
  constructor(
    private readonly http: HttpClient,
    private readonly configAPIURL: URL,
    private readonly timeoutInMS: number
  ) {}

  private toAPIResponse({
    body,
    statusCode,
  }: {
    body: string;
    statusCode: number;
  }) {
    if (statusCode === 200) {
      const parsedBody = JSON.parse(body);

      if (typeof parsedBody.configUpdatedAt === "number") {
        return parsedBody.configUpdatedAt;
      }
    }

    throw new Error(`Invalid response (${statusCode}): ${body}`);
  }

  async getLastUpdatedAt(token: Token): Promise<number> {
    const abort = new AbortController();

    return await Promise.race([
      this.http
        .request(
          "GET",
          this.configAPIURL,
          {
            Authorization: token.asString(),
          },
          "",
          abort.signal
        )
        .then(({ body, statusCode }) =>
          this.toAPIResponse({ body, statusCode })
        ),
      new Promise((resolve, reject) =>
        setTimeout(() => {
          abort.abort();
          reject(new Error("Request timed out"));
        }, this.timeoutInMS)
      ),
    ]);
  }
}
