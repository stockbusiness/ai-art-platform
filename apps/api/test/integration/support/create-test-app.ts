import type { Server } from "node:http";

import type { ApiEnv } from "@ai-art-platform/config";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AppModule } from "../../../src/app.module.js";
import { configureApp } from "../../../src/bootstrap/configure-app.js";
import { API_ENV } from "../../../src/infrastructure/config/api-config.module.js";

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  // Same helmet/cookie-parser/CORS setup as the real main.ts bootstrap
  // (see configure-app.ts) — otherwise integration tests exercising
  // Cookies/CSRF would pass against a differently-configured app than
  // production ever runs.
  configureApp(app, app.get<ApiEnv>(API_ENV));
  await app.init();
  return app;
}

/**
 * Nest's `getHttpServer()` returns `any`; supertest needs a concrete
 * `http.Server`. Centralizing the cast here keeps every call site in the
 * integration specs type-safe.
 */
export function httpServerOf(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}
