import "reflect-metadata";

import { apiEnvSchema, loadDotEnv, loadEnv } from "@ai-art-platform/config";
import { createLogger } from "@ai-art-platform/logger";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { configureApp } from "./bootstrap/configure-app.js";

async function bootstrap(): Promise<void> {
  loadDotEnv(import.meta.url);
  const env = loadEnv(process.env, apiEnvSchema);
  const logger = createLogger({ name: "api", level: env.LOG_LEVEL });

  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app, env);
  const port = 3000;
  await app.listen(port);

  logger.info({ port, nodeEnv: env.NODE_ENV }, "api listening");
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start api", error);
  process.exitCode = 1;
});
