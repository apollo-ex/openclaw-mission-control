export interface Logger {
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
  debug(message: string, context?: unknown): void;
}

const emit = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, context?: unknown) => {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {})
  };

  const serialized = JSON.stringify(payload);

  if (level === 'ERROR') {
    console.error(serialized);
    return;
  }

  if (level === 'WARN') {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
};

export const logger: Logger = {
  info(message, context) {
    emit('INFO', message, context);
  },
  warn(message, context) {
    emit('WARN', message, context);
  },
  error(message, context) {
    emit('ERROR', message, context);
  },
  debug(message, context) {
    emit('DEBUG', message, context);
  }
};
