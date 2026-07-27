import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

import { REDACT_CENSOR, REDACT_PATHS } from "./redaction.js";

export interface CreateLoggerOptions {
  level: string;
  name: string;
}

export function createLogger(
  options: CreateLoggerOptions,
  destination?: DestinationStream,
): Logger {
  const pinoOptions: LoggerOptions = {
    name: options.name,
    level: options.level,
    redact: {
      paths: [...REDACT_PATHS],
      censor: REDACT_CENSOR,
    },
  };
  return destination ? pino(pinoOptions, destination) : pino(pinoOptions);
}

export type { Logger } from "pino";
