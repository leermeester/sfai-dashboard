import { randomUUID } from "crypto";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  data?: Record<string, unknown>;
}

function emit(entry: LogEntry) {
  console.log(JSON.stringify(entry));
}

export function createLogger(correlationId?: string) {
  const corrId = correlationId ?? randomUUID();

  return {
    correlationId: corrId,
    info(message: string, data?: Record<string, unknown>) {
      emit({ timestamp: new Date().toISOString(), level: "info", message, correlationId: corrId, data });
    },
    warn(message: string, data?: Record<string, unknown>) {
      emit({ timestamp: new Date().toISOString(), level: "warn", message, correlationId: corrId, data });
    },
    error(message: string, data?: Record<string, unknown>) {
      emit({ timestamp: new Date().toISOString(), level: "error", message, correlationId: corrId, data });
    },
    debug(message: string, data?: Record<string, unknown>) {
      if (process.env.NODE_ENV !== "production") {
        emit({ timestamp: new Date().toISOString(), level: "debug", message, correlationId: corrId, data });
      }
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
