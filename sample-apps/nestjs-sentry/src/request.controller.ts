import { Controller, Get } from "@nestjs/common";
import { RequestService } from "./request.service";

@Controller()
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Get("/releases")
  async getRequest(): Promise<string> {
    return await this.requestService.getReleases();
  }
}
