import { loadEnv } from "@ai-art-platform/config";
import { createLogger, type Logger } from "@ai-art-platform/logger";

export interface Worker {
  logger: Logger;
  start: () => void;
  stop: () => void;
}

export interface CreateWorkerOptions {
  /** Heartbeat interval in milliseconds. Exposed for testability. */
  heartbeatIntervalMs?: number;
}

/**
 * Startup skeleton only. No job queue, no job processing — this exists so
 * later PRs have a process to attach a real queue consumer to. Never logs
 * env values directly (only NODE_ENV, which is not a secret).
 */
export function createWorker(options: CreateWorkerOptions = {}): Worker {
  const env = loadEnv();
  const logger = createLogger({ name: "worker", level: env.LOG_LEVEL });
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30_000;

  let heartbeat: ReturnType<typeof setInterval> | undefined;

  return {
    logger,
    start() {
      logger.info({ nodeEnv: env.NODE_ENV }, "worker started");
      heartbeat = setInterval(() => {
        logger.debug("worker heartbeat");
      }, heartbeatIntervalMs);
      heartbeat.unref();
    },
    stop() {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = undefined;
      }
      logger.info("worker stopped");
    },
  };
}
