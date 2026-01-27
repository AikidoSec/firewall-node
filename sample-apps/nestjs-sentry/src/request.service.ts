import { Injectable } from "@nestjs/common";
import { request } from "https";

@Injectable()
export class RequestService {
  async getReleases(): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = request(
        "https://api.github.com/repos/AikidoSec/firewall-node/releases",
        {
          headers: {
            "User-Agent": "Node.js HTTP Client - Integration Test",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (d) => {
            data += d;
          });
          res.on("error", (err) => {
            reject(err);
          });
          res.on("end", () => {
            resolve(data);
          });
        }
      );
      req.end();
    });
  }
}
