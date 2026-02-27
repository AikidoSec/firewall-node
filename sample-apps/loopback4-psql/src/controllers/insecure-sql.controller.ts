import { get, HttpErrors, param, post, requestBody } from "@loopback/rest";
import { inject } from "@loopback/core";
import { PsqlDataSource } from "../datasources/psql.datasource";

export class InsecureSqlController {
  constructor(@inject("datasources.psql") private dataSource: PsqlDataSource) {}

  /**
   * Insecure endpoint vulnerable to SQL injection
   * Example: /insecure-sql?username=admin' OR '1'='1
   */
  @get("/insecure-sql")
  async insecureSql(
    @param.query.string("username") username: string
  ): Promise<object[]> {
    if (typeof username !== "string" || username.trim().length === 0) {
      throw new HttpErrors.NotFound("Username query parameter is required");
    }

    // WARNING: This is intentionally vulnerable for testing purposes
    const sql = `SELECT * FROM users WHERE username = '${username}'`;
    return this.dataSource.execute(sql);
  }

  @post("/insecure-sql")
  async insecureSqlPost(
    @requestBody() body: { username: string }
  ): Promise<object[]> {
    if (!body || typeof body !== "object") {
      throw new HttpErrors.BadRequest(
        "Request body must be a valid JSON object"
      );
    }

    const username = body.username;
    if (typeof username !== "string" || username.trim().length === 0) {
      throw new HttpErrors.NotFound("Username in request body is required");
    }

    // WARNING: This is intentionally vulnerable for testing purposes
    const sql = `SELECT * FROM users WHERE username = '${username}'`;
    return this.dataSource.execute(sql);
  }
}
