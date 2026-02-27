import { DefaultCrudRepository } from "@loopback/repository";
import { Users } from "../models/users.model";
import { PsqlDataSource } from "../datasources/psql.datasource";
import { inject } from "@loopback/core";

export class UsersRepository extends DefaultCrudRepository<
  Users,
  typeof Users.prototype.id
> {
  constructor(@inject("datasources.psql") dataSource: PsqlDataSource) {
    super(Users, dataSource);
  }
}
