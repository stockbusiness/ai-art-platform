import { apiEnvSchema, loadEnv, type ApiEnv } from "@ai-art-platform/config";
import { Global, Module } from "@nestjs/common";

/**
 * DI token for the validated, process-wide ApiEnv. A plain string (see
 * tenant-repository.ts for why), not a class — so any provider that needs
 * a config value (cookie flags, CORS origin, lockout thresholds, the auth
 * IP hash secret, ...) can `@Inject(API_ENV)` instead of re-reading
 * `process.env` itself.
 */
export const API_ENV = "API_ENV";

/**
 * Global so every feature module can inject the validated env without
 * each one re-declaring it as a provider. Parsed once per Nest DI
 * container — both the real `main.ts` bootstrap and every integration
 * test's `Test.createTestingModule({ imports: [AppModule] })` trigger this
 * factory, so `process.env` must already be valid by then (see
 * apps/api/test/integration/global-setup.ts).
 */
@Global()
@Module({
  providers: [
    {
      provide: API_ENV,
      useFactory: (): ApiEnv => loadEnv(process.env, apiEnvSchema),
    },
  ],
  exports: [API_ENV],
})
export class ApiConfigModule {}
