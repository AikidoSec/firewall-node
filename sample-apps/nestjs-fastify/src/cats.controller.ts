import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpException,
} from "@nestjs/common";
import { DBService } from "./db.service";

@Controller()
export class CatsController {
  constructor(private readonly dbService: DBService) {}

  @Get("/cats")
  async getRequest(@Query("name") name: string): Promise<string[]> {
    return await this.dbService.getCats(name);
  }

  @Post("/cats")
  async postRequest(@Body() body): Promise<string> {
    if (typeof body.name !== "string") {
      throw new HttpException("Invalid name", 400);
    }
    await this.dbService.addCat(body.name);
    return "Added cat";
  }
}
