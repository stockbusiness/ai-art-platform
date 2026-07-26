import { Controller, Get } from "@nestjs/common";

import { AppService, type DevInfo } from "./app.service.js";

/**
 * Deliberately the only controller in PR-01. It returns development
 * information only — no business logic belongs on a controller (see
 * docs/ARCHITECTURE.md).
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getDevInfo(): DevInfo {
    return this.appService.getDevInfo();
  }
}
