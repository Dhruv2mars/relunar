import pino from "pino";

export function createLogger(level = "info") {
  return pino({
    level,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
