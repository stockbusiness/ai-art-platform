import { Controller, Get } from "@nestjs/common";

export interface HealthResponse {
  status: "ok";
}

/**
 * GET /health deliberately never touches the database — it only confirms
 * the process itself can respond (section 13.2). Use GET /ready to check
 * DB availability.
 */
@Controller("health")
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: "ok" };
  }
}
