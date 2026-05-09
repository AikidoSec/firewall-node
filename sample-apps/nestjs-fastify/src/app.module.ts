import { Module } from "@nestjs/common";
import { CatsController } from "./cats.controller";
import { DBService } from "./db.service";

@Module({
  imports: [],
  controllers: [CatsController],
  providers: [DBService],
})
export class AppModule {}
