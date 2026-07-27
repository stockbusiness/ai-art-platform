import type { Server } from "node:http";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AppModule } from "../../../src/app.module.js";

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
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
