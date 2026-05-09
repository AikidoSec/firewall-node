import { Module } from "@nestjs/common";
import { RequestController } from "./request.controller";
import { RequestService } from "./request.service";
import { CatsController } from "./cats.controller";
import { DBService } from "./db.service";

@Module({
  imports: [],
  controllers: [RequestController, CatsController],
  providers: [RequestService, DBService],
})
export class AppModule {}
